import nodemailer from "nodemailer";

import { authProviderStatus, env } from "./env.js";

type MailMode = "smtp" | "ethereal";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type MailTransport = {
  from: string;
  mode: MailMode;
  transporter: nodemailer.Transporter;
};

type DevEmailPreview = {
  createdAt: string;
  mode: MailMode;
  previewUrl: string | null;
  subject: string;
  to: string;
};

let transportPromise: Promise<MailTransport> | null = null;
let lastDevEmailPreview: DevEmailPreview | null = null;

const createTransport = async (): Promise<MailTransport> => {
  if (authProviderStatus.smtpConfigured) {
    return {
      from: env.smtpFrom,
      mode: "smtp",
      transporter: nodemailer.createTransport({
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
      }),
    };
  }

  const testAccount = await nodemailer.createTestAccount();

  return {
    from: `AdShorts AI <${testAccount.user}>`,
    mode: "ethereal",
    transporter: nodemailer.createTransport({
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
    }),
  };
};

const getTransport = async () => {
  if (!transportPromise) {
    transportPromise = createTransport();
  }

  return transportPromise;
};

export async function sendAppEmail(payload: MailPayload) {
  const { from, mode, transporter } = await getTransport();

  const info = await transporter.sendMail({
    from,
    html: payload.html,
    subject: payload.subject,
    text: payload.text,
    to: payload.to,
  });

  const rawPreviewUrl = mode === "ethereal" ? nodemailer.getTestMessageUrl(info) : null;
  const previewUrl = typeof rawPreviewUrl === "string" ? rawPreviewUrl : null;

  if (mode === "ethereal") {
    lastDevEmailPreview = {
      createdAt: new Date().toISOString(),
      mode,
      previewUrl,
      subject: payload.subject,
      to: payload.to,
    };
    console.info(`[auth] Ethereal preview for ${payload.to}: ${previewUrl ?? "n/a"}`);
  }

  return { mode, previewUrl };
}

export function getMailStatus() {
  return {
    mailMode: authProviderStatus.smtpConfigured ? "smtp" : "ethereal",
    smtpConfigured: authProviderStatus.smtpConfigured,
  } as const;
}

export function getLastDevEmailPreview() {
  return lastDevEmailPreview;
}
