import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function getSmtpPort(): number {
  const raw = getRequiredEnv('SMTP_PORT');
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a positive integer');
  }
  return port;
}

function createTransport() {
  return nodemailer.createTransport({
    host: getRequiredEnv('SMTP_HOST'),
    port: getSmtpPort(),
    auth: {
      user: getRequiredEnv('SMTP_AUTH_USER'),
      pass: getRequiredEnv('SMTP_AUTH_PASS'),
    },
  });
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: getRequiredEnv('SENDER_EMAIL'),
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const subject = 'Library MS password reset';
  const text = [
    `Hello, ${input.name}!`,
    '',
    'We received a request to reset your password.',
    `Open this link to continue: ${input.resetUrl}`,
    '',
    'If you did not request this change, you can ignore this email.',
  ].join('\n');
  const html = [
    `<p>Hello, ${input.name}!</p>`,
    '<p>We received a request to reset your password.</p>',
    `<p><a href="${input.resetUrl}">Reset password</a></p>`,
    '<p>If you did not request this change, you can ignore this email.</p>',
  ].join('');

  await sendMail({
    to: input.to,
    subject,
    text,
    html,
  });
}
