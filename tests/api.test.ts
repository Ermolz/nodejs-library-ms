import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_EXPIRES_IN = '900';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_AUTH_USER = 'user@example.com';
process.env.SMTP_AUTH_PASS = 'password';
process.env.SENDER_EMAIL = 'noreply@example.com';
process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = '15';
process.env.APP_BASE_URL = 'http://localhost:3000';

jest.mock('../src/utils/sendMail', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest') as typeof import('supertest');
const { sendPasswordResetEmail } = require('../src/utils/sendMail') as {
  sendPasswordResetEmail: jest.Mock;
};
const app = require('../src/app').default as import('express').Express;
const { prisma } = require('../src/db/client') as typeof import('../src/db/client');

const sourceDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const testDbPath = path.join(process.cwd(), 'prisma', 'test.db');
const avatarsDirectory = path.join(process.cwd(), 'uploads', 'avatars');
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5z0AAAAASUVORK5CYII=',
  'base64'
);

async function clearUploads(): Promise<void> {
  await fs.mkdir(avatarsDirectory, { recursive: true });
  const files = await fs.readdir(avatarsDirectory);
  await Promise.all(files.map((file) => fs.unlink(path.join(avatarsDirectory, file))));
}

async function resetDatabase(): Promise<void> {
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(input: { email: string; password?: string; name?: string }) {
  return request(app)
    .post('/auth/register')
    .send({
      email: input.email,
      password: input.password ?? 'password123',
      name: input.name ?? 'Test User',
    });
}

async function createAdminUser() {
  const passwordHash = await bcrypt.hash('adminpass123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const loginResponse = await request(app).post('/auth/login').send({
    email: admin.email,
    password: 'adminpass123',
  });

  return {
    admin,
    token: loginResponse.body.token as string,
  };
}

function getResetTokenFromLastEmail(): string {
  const lastCall = sendPasswordResetEmail.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error('Expected sendPasswordResetEmail to be called');
  }
  const payload = lastCall[0] as { resetUrl: string };
  const url = new URL(payload.resetUrl);
  const token = url.searchParams.get('token');
  if (!token) {
    throw new Error('Reset token not found in resetUrl');
  }
  return token;
}

beforeAll(async () => {
  if (!existsSync(sourceDbPath)) {
    throw new Error('Expected prisma/dev.db to exist before running tests');
  }

  if (existsSync(testDbPath)) {
    await fs.unlink(testDbPath);
  }

  await fs.copyFile(sourceDbPath, testDbPath);
  await clearUploads();
});

beforeEach(async () => {
  sendPasswordResetEmail.mockClear();
  await resetDatabase();
  await clearUploads();
});

afterAll(async () => {
  if (existsSync(testDbPath)) {
    await resetDatabase();
  }
  await clearUploads();
  await prisma.$disconnect();
  if (existsSync(testDbPath)) {
    await fs.unlink(testDbPath);
  }
});

describe('auth API', () => {
  it('registers a user and returns avatarUrl as null', async () => {
    const response = await registerUser({ email: 'user1@example.com' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('user1@example.com');
    expect(response.body.user.avatarUrl).toBeNull();
    expect(response.body.token).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
  });

  it('returns the same success message for known and unknown emails on password reset request', async () => {
    await registerUser({ email: 'known@example.com' });

    const knownResponse = await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'known@example.com' });

    const unknownResponse = await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'unknown@example.com' });

    expect(knownResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(200);
    expect(knownResponse.body).toEqual(unknownResponse.body);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const resetTokens = await prisma.passwordResetToken.findMany();
    expect(resetTokens).toHaveLength(1);
  });

  it('resets password, invalidates old refresh tokens, and rejects token reuse', async () => {
    const registerResponse = await registerUser({ email: 'reset@example.com', password: 'password123' });
    const oldRefreshToken = registerResponse.body.refreshToken as string;

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'reset@example.com' })
      .expect(200);

    const token = getResetTokenFromLastEmail();

    const resetResponse = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'newPassword123' });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.message).toBe('Пароль успішно змінено.');

    const oldLoginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'reset@example.com', password: 'password123' });

    const newLoginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'reset@example.com', password: 'newPassword123' });

    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    const reuseResponse = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'anotherPass123' });

    expect(oldLoginResponse.status).toBe(401);
    expect(newLoginResponse.status).toBe(200);
    expect(refreshResponse.status).toBe(401);
    expect(reuseResponse.status).toBe(400);
  });

  it('rejects reset password with invalid token', async () => {
    const response = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'invalid-token', password: 'newPassword123' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid or expired reset token');
  });
});

describe('avatar API', () => {
  it('rejects avatar upload without auth', async () => {
    const response = await request(app)
      .post('/users/me/avatar')
      .attach('avatar', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(401);
  });

  it('rejects avatar upload with invalid MIME type', async () => {
    const registerResponse = await registerUser({ email: 'avatar-invalid@example.com' });

    const response = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${registerResponse.body.token}`)
      .attach('avatar', Buffer.from('not-an-image'), { filename: 'avatar.txt', contentType: 'text/plain' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Avatar must be a JPEG or PNG image');
  });

  it('uploads, replaces, exposes, and deletes avatar files', async () => {
    const registerResponse = await registerUser({ email: 'avatar@example.com' });
    const token = registerResponse.body.token as string;

    const firstUpload = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', pngBuffer, { filename: 'first.png', contentType: 'image/png' });

    expect(firstUpload.status).toBe(200);
    expect(firstUpload.body.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.jpg$/);

    const firstPath = path.join(process.cwd(), firstUpload.body.avatarUrl.slice(1));
    expect(existsSync(firstPath)).toBe(true);

    const meAfterFirstUpload = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meAfterFirstUpload.status).toBe(200);
    expect(meAfterFirstUpload.body.avatarUrl).toBe(firstUpload.body.avatarUrl);

    const secondUpload = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', pngBuffer, { filename: 'second.png', contentType: 'image/png' });

    expect(secondUpload.status).toBe(200);
    expect(secondUpload.body.avatarUrl).not.toBe(firstUpload.body.avatarUrl);
    expect(existsSync(firstPath)).toBe(false);

    const deleteResponse = await request(app)
      .delete('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.message).toBe('Аватарку видалено.');

    const meAfterDelete = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meAfterDelete.body.avatarUrl).toBeNull();

    const secondDelete = await request(app)
      .delete('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(secondDelete.status).toBe(404);
  });
});

describe('loans API', () => {
  it('shows only own loans to USER and all loans to ADMIN', async () => {
    const user1 = await registerUser({ email: 'loan-user1@example.com' });
    const user2 = await registerUser({ email: 'loan-user2@example.com' });
    const { token: adminToken } = await createAdminUser();

    const book1 = await prisma.book.create({
      data: { title: 'Book 1', author: 'Author 1', year: 2024, isbn: 'isbn-1', available: true },
    });
    const book2 = await prisma.book.create({
      data: { title: 'Book 2', author: 'Author 2', year: 2024, isbn: 'isbn-2', available: true },
    });

    await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${user1.body.token}`)
      .send({ bookId: book1.id })
      .expect(201);

    await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${user2.body.token}`)
      .send({ bookId: book2.id })
      .expect(201);

    const user1Loans = await request(app)
      .get('/loans')
      .set('Authorization', `Bearer ${user1.body.token}`);

    const adminLoans = await request(app)
      .get('/loans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(user1Loans.status).toBe(200);
    expect(user1Loans.body).toHaveLength(1);
    expect(user1Loans.body[0].userId).toBe(user1.body.user.id);

    expect(adminLoans.status).toBe(200);
    expect(adminLoans.body).toHaveLength(2);
  });

  it('forbids returning another user\'s loan', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const stranger = await registerUser({ email: 'stranger@example.com' });

    const book = await prisma.book.create({
      data: { title: 'Borrowed Book', author: 'Author', year: 2024, isbn: 'isbn-foreign-loan', available: true },
    });

    const loanResponse = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .send({ bookId: book.id });

    const response = await request(app)
      .post(`/loans/${loanResponse.body.id}/return`)
      .set('Authorization', `Bearer ${stranger.body.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });
});
