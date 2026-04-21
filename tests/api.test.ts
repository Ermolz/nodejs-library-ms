import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import sharp from 'sharp';

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

jest.setTimeout(30000);

const sourceDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const testDbPath = path.join(process.cwd(), 'prisma', 'test.db');
const avatarsDirectory = path.join(process.cwd(), 'uploads', 'avatars');
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5z0AAAAASUVORK5CYII=',
  'base64'
);
const tooLargeAvatarBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 1);

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

  it('rejects register and login payloads that fail validation', async () => {
    const shortPasswordRegister = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' });

    const shortPasswordLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'short' });

    expect(shortPasswordRegister.status).toBe(400);
    expect(shortPasswordRegister.body.error).toContain('email');
    expect(shortPasswordRegister.body.error).toContain('password');
    expect(shortPasswordRegister.body.error).toContain('name');
    expect(shortPasswordLogin.status).toBe(400);
    expect(shortPasswordLogin.body.error).toContain('password');
  });

  it('rejects duplicate registration and invalid login credentials', async () => {
    await registerUser({ email: 'duplicate@example.com', password: 'password123' });

    const duplicateResponse = await registerUser({ email: 'duplicate@example.com' });
    const badLoginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'duplicate@example.com', password: 'wrongPassword123' });

    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.error).toBe('Email already registered');
    expect(badLoginResponse.status).toBe(401);
    expect(badLoginResponse.body.error).toBe('Invalid email or password');
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

  it('sends password reset email with user data and reset URL', async () => {
    await registerUser({ email: 'mail-check@example.com', name: 'Mail Check' });

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'mail-check@example.com' })
      .expect(200);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'mail-check@example.com',
      name: 'Mail Check',
      resetUrl: expect.stringMatching(/^http:\/\/localhost:3000\/reset-password\?token=.+/),
    });
  });

  it('rejects invalid password reset request payloads', async () => {
    const requestResetResponse = await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'bad-email' });

    const resetPasswordResponse = await request(app)
      .post('/auth/reset-password')
      .send({ token: '', password: 'short' });

    expect(requestResetResponse.status).toBe(400);
    expect(requestResetResponse.body.error).toContain('email');
    expect(resetPasswordResponse.status).toBe(400);
    expect(resetPasswordResponse.body.error).toContain('token');
    expect(resetPasswordResponse.body.error).toContain('password');
  });

  it('keeps only the latest password reset token for a user', async () => {
    await registerUser({ email: 'latest-token@example.com' });

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'latest-token@example.com' })
      .expect(200);
    const firstToken = getResetTokenFromLastEmail();

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'latest-token@example.com' })
      .expect(200);
    const secondToken = getResetTokenFromLastEmail();

    const resetWithFirstToken = await request(app)
      .post('/auth/reset-password')
      .send({ token: firstToken, password: 'newPassword123' });
    const resetTokens = await prisma.passwordResetToken.findMany();

    expect(firstToken).not.toBe(secondToken);
    expect(resetWithFirstToken.status).toBe(400);
    expect(resetTokens).toHaveLength(1);
  });

  it('rejects expired password reset tokens and removes them', async () => {
    await registerUser({ email: 'expired-token@example.com' });

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'expired-token@example.com' })
      .expect(200);
    const token = getResetTokenFromLastEmail();

    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const response = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'newPassword123' });
    const resetTokens = await prisma.passwordResetToken.findMany();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid or expired reset token');
    expect(resetTokens).toHaveLength(0);
  });

  it('removes created reset token if email sending fails', async () => {
    await registerUser({ email: 'mail-fails@example.com' });
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({ email: 'mail-fails@example.com' });
      const resetTokens = await prisma.passwordResetToken.findMany();

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
      expect(resetTokens).toHaveLength(0);
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
    expect(resetResponse.body.message).toBeTruthy();

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

  it('rejects avatar upload when file is missing or larger than 5 MB', async () => {
    const registerResponse = await registerUser({ email: 'avatar-limits@example.com' });
    const token = registerResponse.body.token as string;

    const missingFileResponse = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);
    const tooLargeResponse = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', tooLargeAvatarBuffer, { filename: 'huge.png', contentType: 'image/png' });

    expect(missingFileResponse.status).toBe(400);
    expect(missingFileResponse.body.error).toBe('Avatar file is required');
    expect(tooLargeResponse.status).toBe(400);
    expect(tooLargeResponse.body.error).toBe('Avatar must be 5 MB or smaller');
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
    const firstMetadata = await sharp(firstPath).metadata();
    expect(firstMetadata.width).toBe(256);
    expect(firstMetadata.height).toBe(256);
    expect(firstMetadata.format).toBe('jpeg');

    const staticAvatarResponse = await request(app).get(firstUpload.body.avatarUrl);
    expect(staticAvatarResponse.status).toBe(200);
    expect(staticAvatarResponse.headers['content-type']).toContain('image/jpeg');

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
    expect(deleteResponse.body.message).toBeTruthy();

    const meAfterDelete = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meAfterDelete.body.avatarUrl).toBeNull();

    const secondDelete = await request(app)
      .delete('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(secondDelete.status).toBe(404);
  });

  it('returns avatarUrl in admin user list and user details', async () => {
    const userResponse = await registerUser({ email: 'listed-avatar@example.com' });
    const { token: adminToken } = await createAdminUser();

    const uploadResponse = await request(app)
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${userResponse.body.token}`)
      .attach('avatar', pngBuffer, { filename: 'listed.png', contentType: 'image/png' });

    const usersResponse = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const userDetailsResponse = await request(app)
      .get(`/users/${userResponse.body.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(uploadResponse.status).toBe(200);
    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: userResponse.body.user.id,
          avatarUrl: uploadResponse.body.avatarUrl,
        }),
      ])
    );
    expect(userDetailsResponse.status).toBe(200);
    expect(userDetailsResponse.body.avatarUrl).toBe(uploadResponse.body.avatarUrl);
  });

  it('forbids regular users from listing or reading other users', async () => {
    const userResponse = await registerUser({ email: 'regular-user@example.com' });
    const otherUserResponse = await registerUser({ email: 'other-user@example.com' });
    const token = userResponse.body.token as string;

    const listResponse = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${token}`);
    const detailsResponse = await request(app)
      .get(`/users/${otherUserResponse.body.user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(403);
    expect(detailsResponse.status).toBe(403);
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

  it('prevents borrowing an unavailable book and returning a loan twice', async () => {
    const user = await registerUser({ email: 'loan-rules@example.com' });
    const book = await prisma.book.create({
      data: { title: 'Single Copy', author: 'Author', year: 2024, isbn: 'isbn-single-copy', available: true },
    });

    const firstBorrow = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${user.body.token}`)
      .send({ bookId: book.id });
    const secondBorrow = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${user.body.token}`)
      .send({ bookId: book.id });
    const firstReturn = await request(app)
      .post(`/loans/${firstBorrow.body.id}/return`)
      .set('Authorization', `Bearer ${user.body.token}`);
    const secondReturn = await request(app)
      .post(`/loans/${firstBorrow.body.id}/return`)
      .set('Authorization', `Bearer ${user.body.token}`);

    expect(firstBorrow.status).toBe(201);
    expect(secondBorrow.status).toBe(400);
    expect(secondBorrow.body.error).toBe('Book is not available');
    expect(firstReturn.status).toBe(200);
    expect(secondReturn.status).toBe(400);
    expect(secondReturn.body.error).toBe('Loan already returned');
  });
});
