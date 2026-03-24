import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://127.0.0.1:4174" : window.location.origin,
  plugins: [genericOAuthClient()],
});
