import { betterAuth } from "better-auth";
import { database } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { sendAppEmail } from "./mail.js";
const appName = "AdShorts AI";
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
        enabled: true,
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
export async function signInWithTelegram(profile, req, res) {
    const ctx = await auth.$context;
    const adapter = ctx.adapter;
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
    const sessionToken = crypto.randomUUID();
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
    res.cookie("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: "lax",
        path: "/api/auth",
        expires: expiresAt,
    });
    console.info(`[telegram] User signed in: ${user.email} (id=${user.id}, telegramId=${profile.telegramId})`);
    return { user };
}
