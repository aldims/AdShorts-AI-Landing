export const YANDEX_METRIKA_COUNTER_ID = 109093136;

type YandexMetrika = (counterId: number, method: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    ym?: YandexMetrika;
  }
}

export const syncMetrikaUserId = (userId: string | number | null | undefined) => {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId || typeof window === "undefined" || typeof window.ym !== "function") {
    return false;
  }

  try {
    window.ym(YANDEX_METRIKA_COUNTER_ID, "setUserID", normalizedUserId);
    window.ym(YANDEX_METRIKA_COUNTER_ID, "userParams", {
      UserID: normalizedUserId,
      adsflow_user_id: normalizedUserId,
    });
    return true;
  } catch {
    return false;
  }
};
