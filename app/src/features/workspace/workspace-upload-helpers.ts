import type {
  StudioBrandLogoFile,
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  StudioLanguage,
} from "./workspace-types";

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        reject(new Error("Не удалось подготовить файл."));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });

const readBlobAsDataUrl = (blob: Blob) =>
  readFileAsDataUrl(
    new File([blob], "studio-asset", {
      type: blob.type || "application/octet-stream",
    }),
  );

type StudioUploadableAsset =
  | Pick<StudioBrandLogoFile, "assetId" | "dataUrl" | "file" | "fileName" | "mimeType" | "objectUrl">
  | Pick<StudioCustomMusicFile, "assetId" | "dataUrl" | "file" | "fileName" | "objectUrl">
  | Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "file" | "fileName" | "mimeType" | "objectUrl" | "remoteUrl">;

const fetchStudioUploadSourceBlob = async (sourceUrl: string, fallbackMessage: string) => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status}).`);
  }

  return response.blob();
};

const buildStudioUploadFileFromAsset = async (
  asset: StudioUploadableAsset | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string | null;
  },
) => {
  if (!asset) {
    return null;
  }

  const fileName = String(asset.fileName || options.fallbackFileName).trim() || options.fallbackFileName;
  const fallbackMimeType =
    "mimeType" in asset && typeof asset.mimeType === "string" && asset.mimeType.trim()
      ? asset.mimeType.trim()
      : String(options.fallbackMimeType || "").trim() || "application/octet-stream";
  const sourceFile = asset.file;
  if (sourceFile) {
    if (sourceFile.name === fileName && (sourceFile.type || fallbackMimeType) === sourceFile.type) {
      return sourceFile;
    }

    return new File([sourceFile], fileName, {
      type: sourceFile.type || fallbackMimeType,
    });
  }

  const dataUrl = typeof asset.dataUrl === "string" ? asset.dataUrl.trim() : "";
  const remoteUrl = "remoteUrl" in asset && typeof asset.remoteUrl === "string" ? asset.remoteUrl.trim() : "";
  const objectUrl = typeof asset.objectUrl === "string" ? asset.objectUrl.trim() : "";
  const sourceUrl = dataUrl || remoteUrl || objectUrl;
  if (!sourceUrl) {
    return null;
  }

  const blob = await fetchStudioUploadSourceBlob(sourceUrl, "Не удалось подготовить файл для загрузки");
  return new File([blob], fileName, {
    type: blob.type || fallbackMimeType,
  });
};

export const resolveStudioCustomAssetDataUrl = async (
  asset:
    | Pick<StudioBrandLogoFile, "dataUrl" | "file">
    | Pick<StudioCustomMusicFile, "dataUrl" | "file">
    | Pick<StudioCustomVideoFile, "dataUrl" | "file" | "remoteUrl">
    | null
    | undefined,
) => {
  const dataUrl = typeof asset?.dataUrl === "string" ? asset.dataUrl.trim() : "";
  if (dataUrl) {
    return dataUrl;
  }

  if (asset?.file) {
    return readFileAsDataUrl(asset.file);
  }

  const remoteUrl =
    typeof (asset as { remoteUrl?: unknown } | null | undefined)?.remoteUrl === "string"
      ? String((asset as { remoteUrl?: string }).remoteUrl).trim()
      : "";
  if (remoteUrl) {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить удаленный файл (${response.status}).`);
    }

    return readBlobAsDataUrl(await response.blob());
  }

  return undefined;
};

export const appendStudioFormValue = (
  formData: FormData,
  key: string,
  value: boolean | number | string | null | undefined,
) => {
  if (value === null || value === undefined) {
    return;
  }

  formData.append(key, String(value));
};

type StudioDirectMediaUploadAssetPayload = {
  assetId?: number | string | null;
  id?: number | string | null;
};

type StudioDirectMediaUploadPayload = {
  asset?: StudioDirectMediaUploadAssetPayload | null;
  upload?: {
    headers?: Record<string, string> | null;
    method?: string | null;
    url?: string | null;
  } | null;
};

type StudioDirectMediaUploadResponse = {
  data?: StudioDirectMediaUploadPayload | null;
  error?: string;
};

type StudioDirectMediaUploadSession = {
  assetId: number;
  method: string;
  mimeType: string;
  uploadHeaders: Record<string, string>;
  uploadUrl: string;
};

const STUDIO_DIRECT_MEDIA_UPLOAD_MIN_TIMEOUT_MS = 180_000;
const STUDIO_DIRECT_MEDIA_UPLOAD_MAX_TIMEOUT_MS = 20 * 60_000;
const STUDIO_DIRECT_MEDIA_UPLOAD_MIN_BYTES_PER_SECOND = 96 * 1024;

const getStudioDirectUploadAssetId = (payload: StudioDirectMediaUploadPayload | null | undefined) => {
  const rawAssetId = payload?.asset?.assetId ?? payload?.asset?.id;
  const numeric = Number(rawAssetId);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
};

const createStudioDirectUploadTimeoutController = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    clear: () => globalThis.clearTimeout(timeoutId),
    signal: controller.signal,
  };
};

const getStudioDirectMediaUploadTimeoutMs = (fileSize: number) => {
  const sizeBytes = Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0;
  const estimatedMs = Math.ceil(sizeBytes / STUDIO_DIRECT_MEDIA_UPLOAD_MIN_BYTES_PER_SECOND) * 1000;
  return Math.min(
    STUDIO_DIRECT_MEDIA_UPLOAD_MAX_TIMEOUT_MS,
    Math.max(STUDIO_DIRECT_MEDIA_UPLOAD_MIN_TIMEOUT_MS, estimatedMs),
  );
};

export const initializeStudioMediaFileUpload = async (
  file: File,
  options: {
    fileName: string;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    mimeType?: string | null;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const mimeType = String(options.mimeType || file.type || "application/octet-stream").trim() || "application/octet-stream";
  const initResponse = await fetch("/api/studio/media-upload/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: options.fileName || file.name,
      kind: options.kind,
      language: options.language,
      mediaType: options.mediaType,
      mimeType,
      projectId: options.projectId ?? undefined,
      role: options.role,
      segmentIndex: options.segmentIndex ?? undefined,
      sizeBytes: file.size,
    }),
  });
  const initPayload = (await initResponse.json().catch(() => null)) as StudioDirectMediaUploadResponse | null;
  if (!initResponse.ok || !initPayload?.data) {
    throw new Error(initPayload?.error ?? "Не удалось создать upload-сессию.");
  }

  const assetId = getStudioDirectUploadAssetId(initPayload.data);
  const uploadUrl = String(initPayload.data.upload?.url ?? "").trim();
  if (!assetId || !uploadUrl) {
    throw new Error("Upload-сессия не вернула assetId или upload URL.");
  }

  const uploadHeaders = Object.fromEntries(
    Object.entries(initPayload.data.upload?.headers ?? {}).filter(([, value]) => typeof value === "string" && value.trim()),
  );
  if (!Object.keys(uploadHeaders).some((key) => key.toLowerCase() === "content-type")) {
    uploadHeaders["content-type"] = mimeType;
  }

  return {
    assetId,
    method: String(initPayload.data.upload?.method ?? "PUT").trim() || "PUT",
    mimeType,
    uploadHeaders,
    uploadUrl,
  } satisfies StudioDirectMediaUploadSession;
};

export const uploadStudioMediaFileViaDirectSession = async (
  file: File,
  session: StudioDirectMediaUploadSession,
) => {
  const timeout = createStudioDirectUploadTimeoutController(getStudioDirectMediaUploadTimeoutMs(file.size));

  try {
    const uploadResponse = await fetch(session.uploadUrl, {
      body: file,
      headers: session.uploadHeaders,
      method: session.method,
      signal: timeout.signal,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Storage upload failed (${uploadResponse.status}).`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Загрузка файла заняла слишком много времени. Попробуйте еще раз.");
    }

    throw error;
  } finally {
    timeout.clear();
  }
};

export const abortStudioMediaFileUpload = async (assetId: number, reason: string) => {
  const abortResponse = await fetch("/api/studio/media-upload/abort", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assetId,
      reason,
    }),
  });
  const abortPayload = (await abortResponse.json().catch(() => null)) as StudioDirectMediaUploadResponse | null;
  if (!abortResponse.ok) {
    throw new Error(abortPayload?.error ?? "Не удалось отменить upload.");
  }
};

export const completeStudioMediaFileUpload = async (
  assetId: number,
  options: {
    language: StudioLanguage;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const completeResponse = await fetch("/api/studio/media-upload/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assetId,
      language: options.language,
      projectId: options.projectId ?? undefined,
      role: options.role,
      segmentIndex: options.segmentIndex ?? undefined,
    }),
  });
  const completePayload = (await completeResponse.json().catch(() => null)) as StudioDirectMediaUploadResponse | null;
  if (!completeResponse.ok || !completePayload?.data) {
    throw new Error(completePayload?.error ?? "Не удалось подтвердить upload.");
  }

  return getStudioDirectUploadAssetId(completePayload.data) ?? assetId;
};

const uploadStudioMediaFileToStorage = async (
  file: File,
  options: {
    fileName: string;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    mimeType?: string | null;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const session = await initializeStudioMediaFileUpload(file, options);
  try {
    await uploadStudioMediaFileViaDirectSession(file, session);
  } catch (error) {
    try {
      await abortStudioMediaFileUpload(
        session.assetId,
        error instanceof Error ? error.message : "Direct storage upload failed.",
      );
    } catch (abortError) {
      console.warn("[workspace] Failed to abort incomplete direct media upload.", abortError);
    }
    throw error;
  }
  return completeStudioMediaFileUpload(session.assetId, options);
};

export const ensureStudioUploadedAssetId = async (
  asset: StudioUploadableAsset | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string | null;
    forceUpload?: boolean;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const existingAssetId =
    asset && Number.isFinite(Number(asset.assetId)) && Number(asset.assetId) > 0
      ? Math.trunc(Number(asset.assetId))
      : null;
  if (existingAssetId && !options.forceUpload) {
    return existingAssetId;
  }

  const uploadFile = await buildStudioUploadFileFromAsset(asset, {
    fallbackFileName: options.fallbackFileName,
    fallbackMimeType: options.fallbackMimeType,
  });
  if (!uploadFile) {
    return null;
  }

  return uploadStudioMediaFileToStorage(uploadFile, {
    fileName: uploadFile.name || options.fallbackFileName,
    kind: options.kind,
    language: options.language,
    mediaType: options.mediaType,
    mimeType: uploadFile.type || options.fallbackMimeType,
    projectId: options.projectId,
    role: options.role,
    segmentIndex: options.segmentIndex,
  });
};

export const ensureStudioUploadedAssetIdWithInlineFallback = async (
  asset: StudioUploadableAsset | null | undefined,
  options: Parameters<typeof ensureStudioUploadedAssetId>[1],
) => {
  try {
    return {
      assetId: await ensureStudioUploadedAssetId(asset, options),
      dataUrl: undefined,
    };
  } catch (uploadError) {
    try {
      const dataUrl = await resolveStudioCustomAssetDataUrl(asset);
      if (dataUrl) {
        return {
          assetId: null,
          dataUrl,
        };
      }
    } catch (fallbackError) {
      console.warn("[workspace] Failed to prepare inline media upload fallback.", fallbackError);
    }

    throw uploadError;
  }
};

export const WORKSPACE_SEGMENT_REFERENCE_FRAME_MIME_TYPE = "image/jpeg";
const WORKSPACE_SEGMENT_REFERENCE_FRAME_QUALITY = 0.92;
export const WORKSPACE_SEGMENT_REFERENCE_CHARACTER_LIMIT = 3;
const WORKSPACE_SEGMENT_REFERENCE_FRAME_MAX_SIDE = 1280;
const WORKSPACE_SEGMENT_REFERENCE_FRAME_SEEK_SECONDS = 0.25;

export const extractWorkspaceVideoFrameDataUrl = async (
  videoUrl: string,
  options: {
    maxSide?: number;
    seekSeconds?: number;
  } = {},
) => {
  const sourceUrl = videoUrl.trim();
  if (!sourceUrl || typeof document === "undefined") {
    throw new Error("Не удалось открыть видео для референса.");
  }

  return new Promise<string>((resolve, reject) => {
    const video = document.createElement("video");
    const maxSide = Math.max(64, options.maxSide ?? WORKSPACE_SEGMENT_REFERENCE_FRAME_MAX_SIDE);
    const seekSeconds = Math.max(0, options.seekSeconds ?? WORKSPACE_SEGMENT_REFERENCE_FRAME_SEEK_SECONDS);
    let isDone = false;
    let metadataTimeoutId: number | null = null;
    let seekTimeoutId: number | null = null;
    let loadedDataHandler: (() => void) | null = null;

    const clearTimers = () => {
      if (metadataTimeoutId !== null) {
        window.clearTimeout(metadataTimeoutId);
        metadataTimeoutId = null;
      }
      if (seekTimeoutId !== null) {
        window.clearTimeout(seekTimeoutId);
        seekTimeoutId = null;
      }
    };
    const cleanup = () => {
      clearTimers();
      video.onerror = null;
      video.onloadedmetadata = null;
      video.onseeked = null;
      if (loadedDataHandler) {
        video.removeEventListener("loadeddata", loadedDataHandler);
        loadedDataHandler = null;
      }
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // Best effort cleanup for detached browser media elements.
      }
    };
    const fail = (error: Error) => {
      if (isDone) {
        return;
      }
      isDone = true;
      cleanup();
      reject(error);
    };
    const finish = (dataUrl: string) => {
      if (isDone) {
        return;
      }
      isDone = true;
      cleanup();
      resolve(dataUrl);
    };
    const captureFrame = () => {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) {
        fail(new Error("Не удалось прочитать кадр видео."));
        return;
      }

      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        fail(new Error("Не удалось подготовить кадр видео."));
        return;
      }

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(
          WORKSPACE_SEGMENT_REFERENCE_FRAME_MIME_TYPE,
          WORKSPACE_SEGMENT_REFERENCE_FRAME_QUALITY,
        );
        if (!dataUrl || dataUrl === "data:,") {
          fail(new Error("Не удалось сохранить кадр видео."));
          return;
        }
        finish(dataUrl);
      } catch {
        fail(new Error("Не удалось снять кадр с видео."));
      }
    };
    const scheduleSeekTimeout = () => {
      seekTimeoutId = window.setTimeout(() => {
        fail(new Error("Видео не вернуло кадр для референса."));
      }, 15_000);
    };

    video.crossOrigin = "anonymous";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => fail(new Error("Не удалось загрузить видео для референса."));
    video.onseeked = () => {
      if (seekTimeoutId !== null) {
        window.clearTimeout(seekTimeoutId);
        seekTimeoutId = null;
      }
      captureFrame();
    };
    video.onloadedmetadata = () => {
      if (metadataTimeoutId !== null) {
        window.clearTimeout(metadataTimeoutId);
        metadataTimeoutId = null;
      }

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const targetTime = duration > 0 ? Math.min(seekSeconds, Math.max(0, duration - 0.05)) : 0;
      if (targetTime <= 0.02) {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          captureFrame();
          return;
        }

        loadedDataHandler = captureFrame;
        video.addEventListener("loadeddata", loadedDataHandler, { once: true });
        scheduleSeekTimeout();
        return;
      }

      try {
        scheduleSeekTimeout();
        video.currentTime = targetTime;
      } catch {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          captureFrame();
          return;
        }
        fail(new Error("Не удалось перейти к кадру видео."));
      }
    };

    metadataTimeoutId = window.setTimeout(() => {
      fail(new Error("Видео слишком долго готовит референс."));
    }, 15_000);
    video.src = sourceUrl;
    video.load();
  });
};
