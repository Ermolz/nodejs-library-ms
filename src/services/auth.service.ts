import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../db/client';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from '../utils/sendMail';
import {
  getAppBaseUrl,
  getJwtExpiresIn,
  getJwtSecret,
  getPasswordResetExpiresMinutes,
  getRefreshExpiresDays,
} from '../utils/config';
import { toUserResponse } from '../utils/userResponse';
import { LoginInput, RegisterInput } from '../validators/auth.validator';
import { UserResponse } from '../types/user';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_SUCCESS_MESSAGE = 'Якщо вказаний email зареєстрований, лист з інструкціями надіслано.';

function signAccessToken(payload: { userId: string; email: string; role: Role }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
}

function unauthorized(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 401;
  throw err;
}

function badRequest(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  throw err;
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(userId: string): Promise<{ refreshToken: string }> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const days = getRefreshExpiresDays();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
  return { refreshToken: token };
}

export async function register(input: RegisterInput): Promise<{ token: string; refreshToken: string; user: UserResponse }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) badRequest('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'USER',
    },
  });

  const token = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const { refreshToken } = await createRefreshToken(user.id);
  return { token, refreshToken, user: toUserResponse(user) };
}

export async function login(input: LoginInput): Promise<{ token: string; refreshToken: string; user: UserResponse }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) unauthorized('Invalid email or password');

  const match = await bcrypt.compare(input.password, user.passwordHash);
  if (!match) unauthorized('Invalid email or password');

  const token = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const { refreshToken } = await createRefreshToken(user.id);
  return { token, refreshToken, user: toUserResponse(user) };
}

export async function refresh(refreshToken: string): Promise<{ token: string; refreshToken: string; user: UserResponse }> {
  const record = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });
  if (!record) unauthorized('Invalid refresh token');

  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } });
    unauthorized('Refresh token expired');
  }

  await prisma.refreshToken.delete({ where: { id: record.id } });
  const token = signAccessToken({
    userId: record.user.id,
    email: record.user.email,
    role: record.user.role,
  });
  const { refreshToken: newRefreshToken } = await createRefreshToken(record.user.id);

  return {
    token,
    refreshToken: newRefreshToken,
    user: toUserResponse(record.user),
  };
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + getPasswordResetExpiresMinutes() * 60 * 1000);

  const createdToken = await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  } catch (err) {
    await prisma.passwordResetToken.delete({ where: { id: createdToken.id } });
    throw err;
  }

  return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } });
    }
    badRequest('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { message: 'Пароль успішно змінено.' };
}
