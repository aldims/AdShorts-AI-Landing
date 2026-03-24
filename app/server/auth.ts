import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { decodeJwt } from "jose";

import { database } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { sendAppEmail } from "./mail.js";

const appName = "AdShorts AI";
const appOrigin = env.appUrl;

const telegramProvider: GenericOAuthConfig[] = authProviderStatus.telegramEnabled
  ? [
      {
        clientId: env.telegramClientId!,
        clientSecret: env.telegramClientSecret!,
        discoveryUrl: "https://oauth.telegram.org/.well-known/openid-configuration",
        getUserInfo: async (tokens) => {
          if (!tokens.idToken) return null;

          const claims = decodeJwt(tokens.idToken);
          const subject = String(claims.sub ?? claims.id ?? "telegram-user");
          const username = typeof claims.preferred_username === "string" ? claims.preferred_username : undefined;

          return {
            id: subject,
            email: `telegram-${subject}@users.adshorts.local`,
            emailVerified: true,
            name:
              typeof claims.name === "string"
                ? claims.name
                : username
                  ? `@${username}`
                  : "Telegram User",
            picture: typeof claims.picture === "string" ? claims.picture : undefined,
            preferred_username: username,
            sub: subject,
          };
        },
        issuer: "https://oauth.telegram.org",
        mapProfileToUser: async (profile) => {
          const subject =
            typeof profile.sub === "string" ? profile.sub : String(profile.id ?? "telegram-user");
          const username =
            typeof profile.preferred_username === "string" ? profile.preferred_username : undefined;

          return {
            email: `telegram-${subject}@users.adshorts.local`,
            emailVerified: true,
            image: typeof profile.picture === "string" ? profile.picture : null,
            name:
              typeof profile.name === "string"
                ? profile.name
                : username
                  ? `@${username}`
                  : "Telegram User",
          };
        },
        pkce: true,
        providerId: "telegram",
        scopes: ["openid", "profile"],
      },
    ]
  : [];

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
      void sendAppEmail({
        html: `
          <p>You requested a password reset for ${appName}.</p>
          <p><a href="${url}">Reset your password</a></p>
        `,
        subject: "Reset your AdShorts AI password",
        text: `You requested a password reset for ${appName}. Reset it here: ${url}`,
        to: user.email,
      }).catch((error: unknown) => {
        console.error("[auth] Failed to send password reset email", error);
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendAppEmail({
        html: `
          <p>Finish setting up your ${appName} account.</p>
          <p><a href="${url}">Verify your email</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        `,
        subject: "Verify your AdShorts AI email",
        text: `Finish setting up your ${appName} account by opening this link: ${url}`,
        to: user.email,
      }).catch((error: unknown) => {
        console.error("[auth] Failed to send verification email", error);
      });
    },
  },
  plugins: telegramProvider.length ? [genericOAuth({ config: telegramProvider })] : [],
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
  trustedOrigins: [appOrigin],
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
