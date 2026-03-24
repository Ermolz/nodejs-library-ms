import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db/client';
import { UserResponse } from '../types/user';
import { AppError } from '../middleware/errorHandler';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 32;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return secret;
}

function jwtExpiresIn(): number {
  const env = process.env.JWT_EXPIRES_IN;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return 15 * 60;
}

function refreshExpiresDays(): number {
  const days = process.env.REFRESH_TOKEN_EXPIRES_DAYS;
  return days ? parseInt(days, 10) : 7;
}

function toUserResponse(user: { id: string; name: string; email: string; role: Role }): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  };
}

function signAccessToken(payload: { userId: string; email: string; role: Role }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: jwtExpiresIn() });
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

async function createRefreshToken(userId: string): Promise<{ refreshToken: string }> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const days = refreshExpiresDays();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
  return { refreshToken: token };
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
