import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_PROFILE_CHANGE_EVENT,
  LOCAL_PROFILE_KEY,
  LOCAL_PROFILE_VERSION,
  readLocalProfile,
  resetLocalProfile,
  saveLocalProfile,
  SYNTHETIC_PROFILE,
  validateLocalProfile,
} from "@/lib/local-profile";

describe("локальный профиль", () => {
  beforeEach(() => localStorage.clear());

  it("сохраняет, читает и сбрасывает версионированную схему", () => {
    const saved = saveLocalProfile({
      displayName: "  Айдана   Сарсенова ",
      initials: "ас",
      contactEmail: "USER@EXAMPLE.LOCAL",
    });
    expect(saved.version).toBe(LOCAL_PROFILE_VERSION);
    expect(saved.data.displayName).toBe("Айдана Сарсенова");
    expect(saved.data.initials).toBe("АС");
    expect(saved.data.contactEmail).toBe("user@example.local");
    expect(readLocalProfile()).toMatchObject({ source: "local", profile: saved.data });
    expect(resetLocalProfile()).toMatchObject({ source: "fallback", profile: SYNTHETIC_PROFILE });
    expect(localStorage.getItem(LOCAL_PROFILE_KEY)).toBeNull();
  });

  it("сохраняет неизменённые локальные поля при частичном обновлении", () => {
    saveLocalProfile({ department: "Аналитический контроль" });
    saveLocalProfile({ displayName: "Эксперт Verimed", initials: "ЭВ" });
    expect(readLocalProfile().profile.department).toBe("Аналитический контроль");
  });

  it("возвращает synthetic fallback для повреждённого или неизвестного формата", () => {
    localStorage.setItem(LOCAL_PROFILE_KEY, "{broken");
    expect(readLocalProfile().source).toBe("fallback");
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify({ version: 99, data: SYNTHETIC_PROFILE, updatedAt: new Date().toISOString() }));
    expect(readLocalProfile().profile).toEqual(SYNTHETIC_PROFILE);
  });

  it("валидирует поля и допустимые avatar presets", () => {
    expect(() => validateLocalProfile({ ...SYNTHETIC_PROFILE, displayName: " " })).toThrow("Укажите отображаемое имя");
    expect(() => validateLocalProfile({ ...SYNTHETIC_PROFILE, contactEmail: "ошибка" })).toThrow("корректную контактную почту");
    expect(() => validateLocalProfile({ ...SYNTHETIC_PROFILE, initials: "А1" })).toThrow("Инициалы");
    expect(() => validateLocalProfile({ ...SYNTHETIC_PROFILE, neutralAvatarPreset: "photo" })).toThrow("нейтральный аватар");
    expect(validateLocalProfile({ ...SYNTHETIC_PROFILE, initials: "ӘҚ" }).initials).toBe("ӘҚ");
  });

  it("корректно работает при недоступном storage", () => {
    const unavailable = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readLocalProfile(unavailable).source).toBe("fallback");
    expect(() => saveLocalProfile({ displayName: "Эксперт" }, unavailable)).toThrow("Не удалось сохранить");
    expect(resetLocalProfile(unavailable).source).toBe("fallback");
  });

  it("уведомляет компоненты текущей вкладки после save и reset", () => {
    const listener = vi.fn();
    window.addEventListener(LOCAL_PROFILE_CHANGE_EVENT, listener);
    saveLocalProfile({ displayName: "Эксперт Verimed" });
    resetLocalProfile();
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(LOCAL_PROFILE_CHANGE_EVENT, listener);
  });
});
