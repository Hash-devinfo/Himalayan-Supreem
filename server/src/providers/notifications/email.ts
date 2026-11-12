import nodemailer, { type Transporter } from "nodemailer";
import env from "../../config/env.js";

// The email provider (design 1.4). Order code calls sendEmail(); it never talks to SMTP itself,
// so another provider can replace this file later without touching the order code.

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not set up (SMTP settings missing in .env)");
    this.name = "EmailNotConfiguredError";
  }
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!env.smtp) throw new EmailNotConfiguredError();
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    // Give up quickly instead of waiting minutes for a server that does not answer
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return env.smtp !== null;
}

// Plain text -> simple HTML (special characters escaped, line breaks kept)
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${escaped.replace(/\n/g, "<br>")}</div>`;
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<string> {
  const info = await getTransporter().sendMail({
    from: env.smtp?.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: toHtml(message.text),
  });
  return info.messageId;
}

// A short reason for the log and the admin screen. Never includes passwords.
export function describeEmailError(error: unknown): string {
  if (error instanceof EmailNotConfiguredError) return error.message;
  const e = error as { code?: string; responseCode?: number; message?: string };
  if (e.code === "EAUTH")
    return "The email server refused the login (check SMTP_USER and SMTP_PASS)";
  if (
    e.code === "ECONNECTION" ||
    e.code === "ESOCKET" ||
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNREFUSED"
  ) {
    return "Could not connect to the email server (check SMTP_HOST and SMTP_PORT, or try again later)";
  }
  if (e.code === "EENVELOPE")
    return "The email address was refused by the server";
  return (e.message ?? "Unknown email error").slice(0, 200);
}
