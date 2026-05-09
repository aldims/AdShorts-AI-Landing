import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import type express from "express";

export const ADSHORTS_WEB_DEVICE_COOKIE = "adshorts_web_device_id";
export const ADSHORTS_WEB_DEVICE_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

const DEVICE_ID_PATTERN = /^[a-zA-Z0-9._:-]{16,160}$/;

export type AdsflowWebSignalContext = {
  clientIp?: string;
  userAgent?: string;
  webDeviceId: string;
};

const adsflowWebSignalStorage = new AsyncLocalStorage<AdsflowWebSignalContext>();

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const parseCookieHeader = (cookieHeader: unknown) => {
  const result = new Map<string, string>();
  const rawHeader = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!rawHeader.trim()) {
    return result;
  }

  rawHeader.split(";").forEach((part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }
    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!name) {
      return;
    }
    try {
      result.set(name, decodeURIComponent(rawValue));
    } catch {
      result.set(name, rawValue);
    }
  });

  return result;
};

const normalizeDeviceId = (value: unknown) => {
  const normalized = normalizeText(value);
  return DEVICE_ID_PATTERN.test(normalized) ? normalized : "";
};

const createWebDeviceId = () => `site:${randomUUID()}`;

const firstHeaderIp = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return normalizeText(normalized.split(",", 1)[0]);
};

export const resolveAdsflowClientIp = (req: express.Request) =>
  firstHeaderIp(req.header("cf-connecting-ip")) ||
  firstHeaderIp(req.header("x-real-ip")) ||
  firstHeaderIp(req.header("x-forwarded-for")) ||
  normalizeText(req.ip) ||
  normalizeText(req.socket.remoteAddress);

export const resolveAdsflowWebSignalContext = (req: express.Request): AdsflowWebSignalContext => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const existingDeviceId = normalizeDeviceId(cookies.get(ADSHORTS_WEB_DEVICE_COOKIE));
  return {
    clientIp: resolveAdsflowClientIp(req) || undefined,
    userAgent: normalizeText(req.header("user-agent")) || undefined,
    webDeviceId: existingDeviceId || createWebDeviceId(),
  };
};

export const setAdsflowWebDeviceCookie = (
  res: express.Response,
  context: AdsflowWebSignalContext,
  options: { secure: boolean },
) => {
  res.cookie(ADSHORTS_WEB_DEVICE_COOKIE, context.webDeviceId, {
    httpOnly: true,
    maxAge: ADSHORTS_WEB_DEVICE_COOKIE_MAX_AGE_MS,
    path: "/",
    sameSite: "lax",
    secure: options.secure,
  });
};

export const runWithAdsflowWebSignal = <T>(
  context: AdsflowWebSignalContext,
  callback: () => T,
) => adsflowWebSignalStorage.run(context, callback);

export const getCurrentAdsflowWebSignalContext = () => adsflowWebSignalStorage.getStore() ?? null;

export const getCurrentAdsflowWebSignalHeaders = () => {
  const context = getCurrentAdsflowWebSignalContext();
  if (!context?.webDeviceId) {
    return {};
  }

  const headers: Record<string, string> = {
    "X-Web-Device-Id": context.webDeviceId,
  };
  if (context.clientIp) {
    headers["X-Forwarded-For"] = context.clientIp;
    headers["X-Real-IP"] = context.clientIp;
  }
  if (context.userAgent) {
    headers["User-Agent"] = context.userAgent;
  }
  return headers;
};

export const addCurrentAdsflowWebDeviceToBody = <T extends Record<string, unknown>>(body: T): T => {
  const context = getCurrentAdsflowWebSignalContext();
  if (!context?.webDeviceId || body.web_device_id) {
    return body;
  }
  return {
    ...body,
    web_device_id: context.webDeviceId,
  };
};
