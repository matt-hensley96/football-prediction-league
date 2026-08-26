import type { Env } from '../types';

export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Failed to send email to ${to}: ${response.status} ${body}`);
  }
}
