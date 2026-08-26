import type { Env } from '../types';

export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sender: { email: env.EMAIL_FROM }, to: [{ email: to }], subject, htmlContent: html }),
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Failed to send email to ${to}: ${response.status} ${body}`);
  }
}
