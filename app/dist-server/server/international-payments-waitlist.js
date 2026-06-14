import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./env.js";
import { sendAppEmail } from "./mail.js";
const WAITLIST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const WAITLIST_SUPPORT_EMAIL = "support@adshortsai.com";
const WAITLIST_FILE_NAME = "international-payments-waitlist.jsonl";
export class InternationalPaymentsWaitlistValidationError extends Error {
}
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export const parseInternationalPaymentsWaitlistSubmission = (value, metadata = {}) => {
    if (!value || typeof value !== "object") {
        throw new InternationalPaymentsWaitlistValidationError("Could not read the waitlist form.");
    }
    const payload = value;
    const email = normalizeText(payload.email).toLowerCase();
    const source = normalizeText(payload.source) || "/en/pricing";
    const submittedAt = metadata.submittedAt || new Date().toISOString();
    const userAgent = normalizeText(metadata.userAgent) || null;
    if (!email) {
        throw new InternationalPaymentsWaitlistValidationError("Enter your email.");
    }
    if (email.length > 180 || !WAITLIST_EMAIL_RE.test(email)) {
        throw new InternationalPaymentsWaitlistValidationError("Enter a valid email.");
    }
    if (source.length > 240) {
        throw new InternationalPaymentsWaitlistValidationError("Source URL is too long.");
    }
    return {
        email,
        source,
        submittedAt,
        userAgent,
    };
};
const getWaitlistFilePath = () => join(env.dataDir, WAITLIST_FILE_NAME);
const isWaitlistEmailAlreadyRegistered = async (email) => {
    try {
        const fileData = await readFile(getWaitlistFilePath(), "utf8");
        return fileData
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .some((line) => {
            try {
                const entry = JSON.parse(line);
                return String(entry.email ?? "").trim().toLowerCase() === email;
            }
            catch {
                return false;
            }
        });
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
};
export const appendInternationalPaymentsWaitlistSubmission = async (submission) => {
    await mkdir(env.dataDir, { recursive: true });
    if (await isWaitlistEmailAlreadyRegistered(submission.email)) {
        return false;
    }
    await appendFile(getWaitlistFilePath(), `${JSON.stringify(submission)}\n`, "utf8");
    return true;
};
export const notifyInternationalPaymentsWaitlistSubmission = async (submission) => {
    const submittedAt = new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
    }).format(new Date(submission.submittedAt));
    const escapedEmail = escapeHtml(submission.email);
    const escapedSource = escapeHtml(submission.source);
    const escapedSubmittedAt = escapeHtml(submittedAt);
    const escapedUserAgent = escapeHtml(submission.userAgent ?? "n/a");
    await sendAppEmail({
        to: WAITLIST_SUPPORT_EMAIL,
        replyTo: submission.email,
        subject: `International payments waitlist — ${submission.email}`,
        html: `
      <h2>International payments waitlist</h2>
      <p><strong>Email:</strong> ${escapedEmail}</p>
      <p><strong>Source:</strong> ${escapedSource}</p>
      <p><strong>Submitted:</strong> ${escapedSubmittedAt}</p>
      <p><strong>User-Agent:</strong> ${escapedUserAgent}</p>
    `,
        text: [
            "International payments waitlist",
            "",
            `Email: ${submission.email}`,
            `Source: ${submission.source}`,
            `Submitted: ${submittedAt}`,
            `User-Agent: ${submission.userAgent ?? "n/a"}`,
        ].join("\n"),
    });
};
