import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "@/lib/env";

let transporter: Transporter | undefined;

/** True when SMTP is configured; otherwise contact messages are only stored in the DB. */
export function mailEnabled(): boolean {
  const env = serverEnv();
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const env = serverEnv();
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

type ContactMail = { name: string; email: string; message: string; receivedAt: Date };

/** Notifies WHU about a contact form message. Reply-To is the sender. */
export async function sendContactNotification(msg: ContactMail): Promise<void> {
  const env = serverEnv();
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: env.CONTACT_TO_EMAIL,
    replyTo: { name: msg.name, address: msg.email },
    subject: `Kontaktanfrage über die Website: ${msg.name}`,
    text: [
      `Name: ${msg.name}`,
      `E-Mail: ${msg.email}`,
      `Eingegangen: ${msg.receivedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
      "",
      msg.message,
    ].join("\n"),
  });
}
