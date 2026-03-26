import { createHmac, createHash } from "node:crypto";
import { env } from "./env.js";
const MAX_AUTH_AGE_SECONDS = 86400;
export function verifyTelegramLogin(data) {
    if (!env.telegramBotToken)
        return false;
    const { hash, ...rest } = data;
    if (!hash)
        return false;
    const authAge = Math.floor(Date.now() / 1000) - data.auth_date;
    if (authAge > MAX_AUTH_AGE_SECONDS)
        return false;
    const checkString = Object.keys(rest)
        .sort()
        .map((key) => `${key}=${rest[key]}`)
        .join("\n");
    const secretKey = createHash("sha256").update(env.telegramBotToken).digest();
    const computedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");
    return computedHash === hash;
}
export function getTelegramUserProfile(data) {
    const telegramId = String(data.id);
    return {
        telegramId,
        email: `telegram-${telegramId}@users.adshorts.local`,
        name: data.first_name + (data.last_name ? ` ${data.last_name}` : "") ||
            (data.username ? `@${data.username}` : "Telegram User"),
        image: data.photo_url ?? null,
        username: data.username,
    };
}
