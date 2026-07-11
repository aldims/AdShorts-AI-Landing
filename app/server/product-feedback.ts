import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { env } from "./env.js";
import { sendAppEmail } from "./mail.js";

const PRODUCT_FEEDBACK_FILE_NAME = "product-feedback.jsonl";
const PRODUCT_FEEDBACK_SUPPORT_EMAIL = "support@adshortsai.com";

export type ProductFeedbackSubmission = {
  message: string;
  plan: string | null;
  projectId: number | null;
  source: string;
  submittedAt: string;
  userAgent: string | null;
  userEmail: string;
  userId: string;
};

export class ProductFeedbackValidationError extends Error {}

const normalizeInlineText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeMultilineText = (value: unknown) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const parseProductFeedbackSubmission = (
  value: unknown,
  metadata: {
    submittedAt?: string;
    userAgent?: string | null;
    userEmail: string;
    userId: string;
  },
): ProductFeedbackSubmission => {
  if (!value || typeof value !== "object") {
    throw new ProductFeedbackValidationError("Не удалось прочитать отзыв.");
  }

  const payload = value as Record<string, unknown>;
  const message = normalizeMultilineText(payload.message);
  const plan = normalizeInlineText(payload.plan).toUpperCase() || null;
  const source = normalizeInlineText(payload.source) || "/app/studio";
  const parsedProjectId = Number(payload.projectId);
  const projectId = Number.isInteger(parsedProjectId) && parsedProjectId > 0 ? parsedProjectId : null;
  const userEmail = normalizeInlineText(metadata.userEmail).toLowerCase();
  const userId = normalizeInlineText(metadata.userId);

  if (message.length < 3) {
    throw new ProductFeedbackValidationError("Напишите хотя бы несколько слов.");
  }

  if (message.length > 2000) {
    throw new ProductFeedbackValidationError("Отзыв должен быть короче 2000 символов.");
  }

  if (source.length > 240) {
    throw new ProductFeedbackValidationError("Источник отзыва слишком длинный.");
  }

  if (plan && plan.length > 24) {
    throw new ProductFeedbackValidationError("Не удалось определить тариф.");
  }

  if (!userId || !userEmail) {
    throw new ProductFeedbackValidationError("Не удалось определить автора отзыва.");
  }

  return {
    message,
    plan,
    projectId,
    source,
    submittedAt: metadata.submittedAt || new Date().toISOString(),
    userAgent: normalizeInlineText(metadata.userAgent) || null,
    userEmail,
    userId,
  };
};

export const appendProductFeedbackSubmission = async (submission: ProductFeedbackSubmission) => {
  await mkdir(env.dataDir, { recursive: true });
  await appendFile(
    join(env.dataDir, PRODUCT_FEEDBACK_FILE_NAME),
    `${JSON.stringify(submission)}\n`,
    "utf8",
  );
};

export const notifyProductFeedbackSubmission = async (submission: ProductFeedbackSubmission) => {
  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(submission.submittedAt));
  const escapedMessage = escapeHtml(submission.message).replaceAll("\n", "<br />");

  await sendAppEmail({
    to: PRODUCT_FEEDBACK_SUPPORT_EMAIL,
    replyTo: submission.userEmail,
    subject: `Отзыв о продукте — ${submission.userEmail}`,
    html: `
      <h2>Новый отзыв о продукте</h2>
      <p><strong>Пользователь:</strong> ${escapeHtml(submission.userEmail)}</p>
      <p><strong>Тариф:</strong> ${escapeHtml(submission.plan ?? "n/a")}</p>
      <p><strong>Проект:</strong> ${escapeHtml(String(submission.projectId ?? "n/a"))}</p>
      <p><strong>Источник:</strong> ${escapeHtml(submission.source)}</p>
      <p><strong>Отправлено:</strong> ${escapeHtml(submittedAt)}</p>
      <hr />
      <p>${escapedMessage}</p>
    `,
    text: [
      "Новый отзыв о продукте",
      "",
      `Пользователь: ${submission.userEmail}`,
      `Тариф: ${submission.plan ?? "n/a"}`,
      `Проект: ${submission.projectId ?? "n/a"}`,
      `Источник: ${submission.source}`,
      `Отправлено: ${submittedAt}`,
      "",
      submission.message,
    ].join("\n"),
  });
};
