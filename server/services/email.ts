import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    // Dev transport: streams to stdout. jsonTransport avoids actually sending.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendArgs): Promise<void> {
  const from = process.env.SMTP_FROM || 'Tax Prep <no-reply@example.com>';
  const info = await getTransporter().sendMail({ from, ...args });
  if (!process.env.SMTP_HOST) {
    // Dev: print the mail (and any embedded code) so the user can see it in the console.
     
    console.log('\n===== DEV EMAIL =====');
    console.log(`To: ${args.to}`);
    console.log(`Subject: ${args.subject}`);
    console.log(args.text);
    console.log('======================\n');
    void info; // suppress unused warning
  }
}

export async function sendTwoFactorEmail(to: string, code: string, purpose: 'login' | 'email_verify') {
  const label = purpose === 'login' ? 'sign-in' : 'email verification';
  await sendEmail({
    to,
    subject: `Your Tax Prep ${label} code`,
    text:
      `Your ${label} code is: ${code}\n\n` +
      `This code expires in 5 minutes. If you did not request this, ignore this email.\n`,
  });
}
