import { sendAppEmail } from "./mail.js";

export const AGENCY_CONTACT_SUPPORT_EMAIL = "support@adshortsai.com";

export type AgencyContactSubmission = {
  company: string;
  email: string;
  message: string;
  name: string;
  source: string;
};

export class AgencyContactValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeMultilineText = (value: unknown) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const assertLength = (value: string, maxLength: number, fieldLabel: string) => {
  if (!value) {
    throw new AgencyContactValidationError(`Поле «${fieldLabel}» обязательно.`);
  }

  if (value.length > maxLength) {
    throw new AgencyContactValidationError(`Поле «${fieldLabel}» слишком длинное.`);
  }
};

export const parseAgencyContactSubmission = (value: unknown): AgencyContactSubmission => {
  if (!value || typeof value !== "object") {
    throw new AgencyContactValidationError("Не удалось прочитать данные формы.");
  }

  const payload = value as Record<string, unknown>;
  const name = normalizeText(payload.name);
  const email = normalizeText(payload.email).toLowerCase();
  const company = normalizeText(payload.company);
  const message = normalizeMultilineText(payload.message);
  const source = normalizeText(payload.source) || "/pricing";

  assertLength(name, 120, "Имя");
  assertLength(email, 180, "Email");
  assertLength(company, 160, "Компания / команда");
  assertLength(message, 2000, "Задача");

  if (!EMAIL_RE.test(email)) {
    throw new AgencyContactValidationError("Укажите корректный email.");
  }

  if (message.length < 10) {
    throw new AgencyContactValidationError("Опишите задачу чуть подробнее.");
  }

  return {
    company,
    email,
    message,
    name,
    source,
  };
};

export const sendAgencyContactSubmission = async (submission: AgencyContactSubmission) => {
  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date());

  const escapedName = escapeHtml(submission.name);
  const escapedEmail = escapeHtml(submission.email);
  const escapedCompany = escapeHtml(submission.company);
  const escapedMessage = escapeHtml(submission.message).replaceAll("\n", "<br />");
  const escapedSource = escapeHtml(submission.source);
  const escapedSubmittedAt = escapeHtml(submittedAt);

  await sendAppEmail({
    to: AGENCY_CONTACT_SUPPORT_EMAIL,
    replyTo: submission.email,
    subject: `Agency / Teams lead — ${submission.company}`,
    html: `
      <h2>Новая заявка Agency / Teams</h2>
      <p><strong>Имя:</strong> ${escapedName}</p>
      <p><strong>Email:</strong> ${escapedEmail}</p>
      <p><strong>Компания / команда:</strong> ${escapedCompany}</p>
      <p><strong>Откуда:</strong> ${escapedSource}</p>
      <p><strong>Отправлено:</strong> ${escapedSubmittedAt}</p>
      <hr />
      <p><strong>Описание задачи:</strong></p>
      <p>${escapedMessage}</p>
    `,
    text: [
      "Новая заявка Agency / Teams",
      "",
      `Имя: ${submission.name}`,
      `Email: ${submission.email}`,
      `Компания / команда: ${submission.company}`,
      `Откуда: ${submission.source}`,
      `Отправлено: ${submittedAt}`,
      "",
      "Описание задачи:",
      submission.message,
    ].join("\n"),
  });
};
