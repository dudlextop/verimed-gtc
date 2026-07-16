export const LOCAL_PROFILE_VERSION = 1 as const;
export const LOCAL_PROFILE_KEY = "verimed:local-profile";
export const LOCAL_PROFILE_CHANGE_EVENT = "verimed:local-profile-change";

export const NEUTRAL_AVATAR_PRESETS = ["neutral", "blue", "cyan", "teal"] as const;
export type NeutralAvatarPreset = (typeof NEUTRAL_AVATAR_PRESETS)[number];

export interface LocalProfileData {
  displayName: string;
  jobTitle: string;
  department: string;
  contactEmail: string;
  initials: string;
  neutralAvatarPreset: NeutralAvatarPreset;
}

export interface LocalProfileEnvelope {
  version: typeof LOCAL_PROFILE_VERSION;
  data: LocalProfileData;
  updatedAt: string;
}

export interface LocalProfileReadResult {
  profile: LocalProfileData;
  updatedAt: string | null;
  source: "local" | "fallback";
}

export const SYNTHETIC_PROFILE: Readonly<LocalProfileData> = {
  displayName: "Айдана Сарсенова",
  jobTitle: "Ведущий эксперт",
  department: "Контроль медицинских услуг",
  contactEmail: "a.sarsenova@example.local",
  initials: "АС",
  neutralAvatarPreset: "neutral",
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function notifyLocalProfileChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_PROFILE_CHANGE_EVENT));
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("Профиль содержит некорректное значение");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maximum) throw new Error(`Допустимо не более ${maximum} символов`);
  return normalized;
}

export function validateLocalProfile(value: unknown): LocalProfileData {
  const source = record(value);
  if (!source) throw new Error("Не удалось прочитать локальный профиль");
  const displayName = normalizedText(source.displayName, 80);
  const jobTitle = normalizedText(source.jobTitle, 80);
  const department = normalizedText(source.department, 100);
  const contactEmail = normalizedText(source.contactEmail, 160).toLowerCase();
  const initials = normalizedText(source.initials, 3).toUpperCase();
  const neutralAvatarPreset = source.neutralAvatarPreset;
  if (displayName.length < 2) throw new Error("Укажите отображаемое имя");
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Укажите корректную контактную почту");
  }
  if (!/^[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]{1,3}$/u.test(initials)) {
    throw new Error("Инициалы должны содержать от одной до трёх букв");
  }
  if (
    typeof neutralAvatarPreset !== "string" ||
    !NEUTRAL_AVATAR_PRESETS.includes(neutralAvatarPreset as NeutralAvatarPreset)
  ) {
    throw new Error("Выберите доступный нейтральный аватар");
  }
  return {
    displayName,
    jobTitle,
    department,
    contactEmail,
    initials,
    neutralAvatarPreset: neutralAvatarPreset as NeutralAvatarPreset,
  };
}

function storageOrNull(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseEnvelope(raw: string): LocalProfileEnvelope {
  const parsed = record(JSON.parse(raw));
  if (!parsed) throw new Error("Повреждённый локальный профиль");
  const version = parsed.version;
  const data = version === 0 ? parsed.data ?? parsed : parsed.data;
  if (version !== 0 && version !== LOCAL_PROFILE_VERSION) {
    throw new Error("Версия локального профиля не поддерживается");
  }
  const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString();
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error("Некорректная дата локального профиля");
  return {
    version: LOCAL_PROFILE_VERSION,
    data: validateLocalProfile(data),
    updatedAt,
  };
}

export function readLocalProfile(storage?: StorageLike | null): LocalProfileReadResult {
  const target = storageOrNull(storage);
  if (!target) return { profile: { ...SYNTHETIC_PROFILE }, updatedAt: null, source: "fallback" };
  try {
    const raw = target.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return { profile: { ...SYNTHETIC_PROFILE }, updatedAt: null, source: "fallback" };
    const envelope = parseEnvelope(raw);
    return { profile: envelope.data, updatedAt: envelope.updatedAt, source: "local" };
  } catch {
    return { profile: { ...SYNTHETIC_PROFILE }, updatedAt: null, source: "fallback" };
  }
}

export function saveLocalProfile(
  value: Partial<LocalProfileData>,
  storage?: StorageLike | null,
): LocalProfileEnvelope {
  const target = storageOrNull(storage);
  const current = readLocalProfile(target).profile;
  const data = validateLocalProfile({ ...current, ...value });
  const envelope: LocalProfileEnvelope = {
    version: LOCAL_PROFILE_VERSION,
    data,
    updatedAt: new Date().toISOString(),
  };
  if (!target) throw new Error("Локальное сохранение недоступно в этом браузере");
  try {
    target.setItem(LOCAL_PROFILE_KEY, JSON.stringify(envelope));
  } catch {
    throw new Error("Не удалось сохранить локальный профиль");
  }
  notifyLocalProfileChange();
  return envelope;
}

export function resetLocalProfile(storage?: StorageLike | null): LocalProfileReadResult {
  const target = storageOrNull(storage);
  try {
    target?.removeItem(LOCAL_PROFILE_KEY);
  } catch {
    // Fallback below is intentional when storage is unavailable.
  }
  notifyLocalProfileChange();
  return { profile: { ...SYNTHETIC_PROFILE }, updatedAt: null, source: "fallback" };
}

export function localProfileStorageAvailable(storage?: StorageLike | null): boolean {
  const target = storageOrNull(storage);
  if (!target) return false;
  const probeKey = `${LOCAL_PROFILE_KEY}:probe`;
  try {
    target.setItem(probeKey, "1");
    target.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}
