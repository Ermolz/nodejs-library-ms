import nodemailer from 'nodemailer';
import { getSmtpConfig } from './config';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function createTransport() {
  const smtp = getSmtpConfig();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    auth: smtp.auth,
  });
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = createTransport();
  const smtp = getSmtpConfig();
  await transporter.sendMail({
    from: smtp.from,
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
