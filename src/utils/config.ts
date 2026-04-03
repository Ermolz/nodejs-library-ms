function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function getPositiveIntegerEnv(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (!raw) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} must be set`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function getJwtSecret(): string {
  const secret = getRequiredEnv('JWT_SECRET');
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return secret;
}

export function getJwtExpiresIn(): number {
  const env = process.env.JWT_EXPIRES_IN;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return 15 * 60;
}

export function getRefreshExpiresDays(): number {
  return getPositiveIntegerEnv('REFRESH_TOKEN_EXPIRES_DAYS', 7);
}

export function getPasswordResetExpiresMinutes(): number {
  return getPositiveIntegerEnv('PASSWORD_RESET_TOKEN_EXPIRES_MINUTES', 15);
}

export function getAppBaseUrl(): string {
  return getRequiredEnv('APP_BASE_URL').replace(/\/$/, '');
}

export function getSmtpConfig() {
  return {
    host: getRequiredEnv('SMTP_HOST'),
    port: getPositiveIntegerEnv('SMTP_PORT'),
    auth: {
      user: getRequiredEnv('SMTP_AUTH_USER'),
      pass: getRequiredEnv('SMTP_AUTH_PASS'),
    },
    from: getRequiredEnv('SENDER_EMAIL'),
  };
}
