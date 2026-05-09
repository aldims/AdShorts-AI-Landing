import { createHmac, randomUUID } from "node:crypto";

import type { CookieOptions, Request, Response } from "express";

import { betterAuth } from "better-auth";

import { database } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { sendAppEmail } from "./mail.js";

const appName = "AdShorts AI";
const BETTER_AUTH_SESSION_COOKIE_BASE_NAME = "better-auth.session_token";
const BETTER_AUTH_LEGACY_SESSION_COOKIE_PATHS = ["/", "/api/auth"] as const;

export const getBetterAuthSessionCookieName = () => {
  const usesSecureCookies = env.isProduction || env.authBaseUrl.startsWith("https://");
  return usesSecureCookies
    ? `__Secure-${BETTER_AUTH_SESSION_COOKIE_BASE_NAME}`
    : BETTER_AUTH_SESSION_COOKIE_BASE_NAME;
};

export const signBetterAuthSessionCookieValue = (sessionToken: string) => {
  const signature = createHmac("sha256", env.authSecret).update(sessionToken).digest("base64");
  return `${sessionToken}.${signature}`;
};

export const setBetterAuthSessionCookie = (res: Response, sessionToken: string, expiresAt: Date) => {
  const activeCookieName = getBetterAuthSessionCookieName();
  const baseCookieOptions: CookieOptions = {
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

const normalizeOrigin = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const trustedOrigins = Array.from(
  new Set(
    [
      normalizeOrigin(env.appUrl),
      normalizeOrigin(env.authBaseUrl),
      env.isProduction ? null : "http://localhost:4174",
      env.isProduction ? null : "http://127.0.0.1:4174",
    ].filter((value): value is string => Boolean(value)),
  ),
);

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
        text:
          `Someone tried to create an account for ${user.email} in ${appName}. ` +
          "If that was you, try signing in instead. If not, you can ignore this email.",
        to: user.email,
      }).catch((error: unknown) => {
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
      } catch (error: unknown) {
        console.error("[auth] Failed to send password reset email", error);
        throw new Error(
          "Не удалось отправить письмо для сброса пароля. Проверьте SMTP на сервере или попробуйте позже.",
        );
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
      } catch (error: unknown) {
        console.error("[auth] Failed to send verification email", error);
        throw new Error(
          "Не удалось отправить письмо с подтверждением. Проверьте настройки SMTP на сервере и поле SMTP_PASS в .env (для пароля с пробелами используйте кавычки), затем попробуйте снова.",
        );
      }
    },
  },
  plugins: [],
  secret: env.authSecret,
  socialProviders: {
    ...(authProviderStatus.googleEnabled
      ? {
          google: {
            clientId: env.googleClientId!,
            clientSecret: env.googleClientSecret!,
            prompt: "select_account",
          },
        }
      : {}),
  },
  trustedOrigins,
});

let authSchemaPromise: Promise<void> | null = null;

export const ensureAuthSchema = async () => {
  if (!authSchemaPromise) {
    authSchemaPromise = (async () => {
      const authWithContext = auth as unknown as {
        $context?: Promise<{
          runMigrations?: () => Promise<void>;
        }>;
      };
      const context = await authWithContext.$context;

      if (!context?.runMigrations) {
        throw new Error("Better Auth migration context is unavailable.");
      }

      await context.runMigrations();
    })();
  }

  await authSchemaPromise;
};

type TelegramProfile = {
  telegramId: string;
  email: string;
  name: string;
  image: string | null;
  username?: string;
};

export async function signInWithTelegram(
  profile: TelegramProfile,
  req: Request,
  res: Response,
): Promise<{ user: { id: string; email: string; name: string } }> {
  const ctx = await (auth as unknown as { $context: Promise<{ adapter: unknown }> }).$context;
  const adapter = ctx.adapter as {
    findOne: <T>(options: { model: string; where: { field: string; value: string }[] }) => Promise<T | null>;
    create: <T>(options: { model: string; data: Record<string, unknown> }) => Promise<T>;
    update: <T>(options: { model: string; where: { field: string; value: string }[]; update: Record<string, unknown> }) => Promise<T>;
  };

  let account = await adapter.findOne<{ userId: string }>({
    model: "account",
    where: [
      { field: "providerId", value: "telegram" },
      { field: "accountId", value: profile.telegramId },
    ],
  });

  let userId: string;

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
  } else {
    let existingUser = await adapter.findOne<{ id: string }>({
      model: "user",
      where: [{ field: "email", value: profile.email }],
    });

    if (!existingUser) {
      existingUser = await adapter.create<{ id: string }>({
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

  const user = await adapter.findOne<{ id: string; email: string; name: string }>({
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
