import nodemailer from "nodemailer";

import { authProviderStatus, env } from "./env.js";

type MailMode = "smtp" | "ethereal";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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
    const useStartTls = !env.smtpSecure && env.smtpPort === 587;
    const transporter = nodemailer.createTransport({
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      ...(useStartTls ? { requireTLS: true } : {}),
    });

    if (env.smtpHost?.toLowerCase().includes("gmail") && env.smtpUser && !env.smtpFrom.includes(env.smtpUser)) {
      console.warn(
        "[mail] Gmail SMTP: адрес в SMTP_FROM должен совпадать с SMTP_USER (или быть добавленным алиасом в настройках Gmail), иначе письма часто не доставляются.",
      );
    }

    try {
      await transporter.verify();
      console.info("[mail] SMTP verify OK", { host: env.smtpHost, port: env.smtpPort });
    } catch (error) {
      console.error(
        "[mail] SMTP verify failed — письма, скорее всего, не отправятся. Проверьте SMTP_*, для Gmail нужен пароль приложения; если в пароле есть пробелы, задайте SMTP_PASS в кавычках в .env.",
        error,
      );
    }

    return {
      from: env.smtpFrom,
      mode: "smtp",
      transporter,
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
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    to: payload.to,
  });

  if (mode === "smtp") {
    console.info("[mail] SMTP sendMail OK", {
      to: payload.to,
      messageId: info.messageId,
      response: typeof info.response === "string" ? info.response.slice(0, 200) : info.response,
    });
  }

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
