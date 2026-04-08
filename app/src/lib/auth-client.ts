import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:4174" : window.location.origin,
  plugins: [genericOAuthClient()],
});
