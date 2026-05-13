import { createHmac, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { database } from "./database.js";
import { normalizeEmailLoginAddress } from "./email-code.js";
import { authProviderStatus, env } from "./env.js";
import { sendAppEmail } from "./mail.js";
const appName = "AdShorts AI";
const BETTER_AUTH_SESSION_COOKIE_BASE_NAME = "better-auth.session_token";
const BETTER_AUTH_LEGACY_SESSION_COOKIE_PATHS = ["/", "/api/auth"];
export const getBetterAuthSessionCookieName = () => {
    const usesSecureCookies = env.isProduction || env.authBaseUrl.startsWith("https://");
    return usesSecureCookies
        ? `__Secure-${BETTER_AUTH_SESSION_COOKIE_BASE_NAME}`
        : BETTER_AUTH_SESSION_COOKIE_BASE_NAME;
};
export const signBetterAuthSessionCookieValue = (sessionToken) => {
    const signature = createHmac("sha256", env.authSecret).update(sessionToken).digest("base64");
    return `${sessionToken}.${signature}`;
};
export const setBetterAuthSessionCookie = (res, sessionToken, expiresAt) => {
    const activeCookieName = getBetterAuthSessionCookieName();
    const baseCookieOptions = {
        httpOnly: true,
        sameSite: "lax",
        secure: activeCookieName.startsWith("__Secure-") || env.isProduction,
    };
    for (const cookieName of [BETTER_AUTH_SESSION_COOKIE_BASE_NAME, `__Secure-${BETTER_AUTH_SESSION_COOKIE_BASE_NAME}`]) {
        for (const path of BETTER_AUTH_LEGACY_SESSION_COOKIE_PATHS) {
            if (cookieName === activeCookieName && path === "/") {
                continue;
            }
            res.clearCookie(cookieName, {
                ...baseCookieOptions,
                path,
            });
        }
    }
    res.cookie(activeCookieName, signBetterAuthSessionCookieValue(sessionToken), {
        ...baseCookieOptions,
        encode: String,
        expires: expiresAt,
        path: "/",
    });
};
const normalizeOrigin = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value).origin;
    }
    catch {
        return null;
    }
};
const trustedOrigins = Array.from(new Set([
    normalizeOrigin(env.appUrl),
    normalizeOrigin(env.authBaseUrl),
    env.isProduction ? null : "http://localhost:4174",
    env.isProduction ? null : "http://127.0.0.1:4174",
].filter((value) => Boolean(value))));
export const auth = betterAuth({
    baseURL: env.authBaseUrl,
    database,
    emailAndPassword: {
        autoSignIn: false,
        enabled: false,
        minPasswordLength: 8,
        onExistingUserSignUp: async ({ user }) => {
            void sendAppEmail({
                html: `
          <p>Someone tried to create an account for <strong>${user.email}</strong> in ${appName}.</p>
          <p>If that was you, try signing in instead. If not, you can ignore this email.</p>
        `,
                subject: "Sign-up attempt detected",
                text: `Someone tried to create an account for ${user.email} in ${appName}. ` +
                    "If that was you, try signing in instead. If not, you can ignore this email.",
                to: user.email,
            }).catch((error) => {
                console.error("[auth] Failed to send existing-user warning email", error);
            });
        },
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            try {
                await sendAppEmail({
                    html: `
          <p>You requested a password reset for ${appName}.</p>
          <p><a href="${url}">Reset your password</a></p>
        `,
                    subject: "Reset your AdShorts AI password",
                    text: `You requested a password reset for ${appName}. Reset it here: ${url}`,
                    to: user.email,
                });
            }
            catch (error) {
                console.error("[auth] Failed to send password reset email", error);
                throw new Error("Не удалось отправить письмо для сброса пароля. Проверьте SMTP на сервере или попробуйте позже.");
            }
        },
    },
    emailVerification: {
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            try {
                await sendAppEmail({
                    html: `
          <p>Finish setting up your ${appName} account.</p>
          <p><a href="${url}">Verify your email</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        `,
                    subject: "Verify your AdShorts AI email",
                    text: `Finish setting up your ${appName} account by opening this link: ${url}`,
                    to: user.email,
                });
            }
            catch (error) {
                console.error("[auth] Failed to send verification email", error);
                throw new Error("Не удалось отправить письмо с подтверждением. Проверьте настройки SMTP на сервере и поле SMTP_PASS в .env (для пароля с пробелами используйте кавычки), затем попробуйте снова.");
            }
        },
    },
    plugins: [],
    secret: env.authSecret,
    socialProviders: {
        ...(authProviderStatus.googleEnabled
            ? {
                google: {
                    clientId: env.googleClientId,
                    clientSecret: env.googleClientSecret,
                    prompt: "select_account",
                },
            }
            : {}),
    },
    trustedOrigins,
});
let authSchemaPromise = null;
export const ensureAuthSchema = async () => {
    if (!authSchemaPromise) {
        authSchemaPromise = (async () => {
            const authWithContext = auth;
            const context = await authWithContext.$context;
            if (!context?.runMigrations) {
                throw new Error("Better Auth migration context is unavailable.");
            }
            await context.runMigrations();
        })();
    }
    await authSchemaPromise;
};
const TELEGRAM_USERNAME_SCOPE_PREFIX = "telegram_username:";
const normalizeTelegramUsername = (value) => {
    const normalized = String(value ?? "").trim().replace(/^@/, "");
    return /^[A-Za-z0-9_]{5,32}$/.test(normalized) ? normalized : null;
};
const buildTelegramAccountScope = (username) => {
    const normalizedUsername = normalizeTelegramUsername(username);
    return ["openid", "profile", normalizedUsername ? `${TELEGRAM_USERNAME_SCOPE_PREFIX}${normalizedUsername}` : null]
        .filter(Boolean)
        .join(" ");
};
const readTelegramUsernameFromAccountScope = (scope) => {
    const scopeParts = String(scope ?? "").split(/\s+/).filter(Boolean);
    const usernamePart = scopeParts.find((part) => part.startsWith(TELEGRAM_USERNAME_SCOPE_PREFIX));
    return normalizeTelegramUsername(usernamePart?.slice(TELEGRAM_USERNAME_SCOPE_PREFIX.length));
};
const buildEmailLoginDisplayName = (email) => {
    const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    return (localPart || email).slice(0, 80);
};
const getAuthAdapter = async () => {
    const ctx = await auth.$context;
    return ctx.adapter;
};
export async function getTelegramAccountDisplay(userId) {
    if (!userId)
        return null;
    const adapter = await getAuthAdapter();
    const account = await adapter.findOne({
        model: "account",
        where: [
            { field: "userId", value: userId },
            { field: "providerId", value: "telegram" },
        ],
    });
    if (!account)
        return null;
    const username = readTelegramUsernameFromAccountScope(account.scope);
    return {
        label: username ? `@${username}` : `Telegram ID ${account.accountId}`,
        username,
    };
}
export async function signInWithEmailCode(rawEmail, req, res) {
    const email = normalizeEmailLoginAddress(rawEmail);
    if (!email) {
        throw new Error("Invalid email address.");
    }
    const adapter = await getAuthAdapter();
    let user = await adapter.findOne({
        model: "user",
        where: [{ field: "email", value: email }],
    });
    if (!user) {
        user = await adapter.create({
            model: "user",
            data: {
                email,
                emailVerified: true,
                name: buildEmailLoginDisplayName(email),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }
    else {
        await adapter.update({
            model: "user",
            where: [{ field: "id", value: user.id }],
            update: {
                emailVerified: true,
                updatedAt: new Date(),
            },
        });
        const updatedUser = await adapter.findOne({
            model: "user",
            where: [{ field: "id", value: user.id }],
        });
        if (!updatedUser) {
            throw new Error("User not found after email code sign-in.");
        }
        user = updatedUser;
    }
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await adapter.create({
        model: "session",
        data: {
            token: sessionToken,
            userId: user.id,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: req.ip ?? null,
            userAgent: req.headers["user-agent"] ?? null,
        },
    });
    setBetterAuthSessionCookie(res, sessionToken, expiresAt);
    console.info(`[email-code] User signed in: ${user.email} (id=${user.id})`);
    return { user };
}
export async function signInWithTelegram(profile, req, res) {
    const adapter = await getAuthAdapter();
    let account = await adapter.findOne({
        model: "account",
        where: [
            { field: "providerId", value: "telegram" },
            { field: "accountId", value: profile.telegramId },
        ],
    });
    let userId;
    if (account) {
        userId = account.userId;
        await adapter.update({
            model: "account",
            where: [
                { field: "providerId", value: "telegram" },
                { field: "accountId", value: profile.telegramId },
            ],
            update: {
                scope: buildTelegramAccountScope(profile.username),
                updatedAt: new Date(),
            },
        });
        await adapter.update({
            model: "user",
            where: [{ field: "id", value: userId }],
            update: {
                name: profile.name,
                image: profile.image,
                updatedAt: new Date(),
            },
        });
    }
    else {
        let existingUser = await adapter.findOne({
            model: "user",
            where: [{ field: "email", value: profile.email }],
        });
        if (!existingUser) {
            existingUser = await adapter.create({
                model: "user",
                data: {
                    email: profile.email,
                    emailVerified: true,
                    name: profile.name,
                    image: profile.image,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
        userId = existingUser.id;
        await adapter.create({
            model: "account",
            data: {
                userId,
                providerId: "telegram",
                accountId: profile.telegramId,
                scope: buildTelegramAccountScope(profile.username),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }
    const user = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: userId }],
    });
    if (!user) {
        throw new Error("User not found after Telegram sign-in.");
    }
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await adapter.create({
        model: "session",
        data: {
            token: sessionToken,
            userId: user.id,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: req.ip ?? null,
            userAgent: req.headers["user-agent"] ?? null,
        },
    });
    setBetterAuthSessionCookie(res, sessionToken, expiresAt);
    console.info(`[telegram] User signed in: ${user.email} (id=${user.id}, telegramId=${profile.telegramId})`);
    return { user };
}
