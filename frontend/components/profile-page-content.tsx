"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileCheck2,
  History,
  Mail,
  Pencil,
  RotateCcw,
  Save,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocalProfile } from "@/hooks/use-local-profile";
import {
  localProfileStorageAvailable,
  NEUTRAL_AVATAR_PRESETS,
  SYNTHETIC_PROFILE,
  validateLocalProfile,
  type LocalProfileData,
  type NeutralAvatarPreset,
} from "@/lib/local-profile";
import { cn } from "@/lib/utils";
import {
  Button,
  DataPanel,
  InlineNotice,
  Input,
  PageHeader,
  SectionHeader,
  Select,
} from "@/components/foundation";

type FieldName = keyof LocalProfileData;
type FieldErrors = Partial<Record<FieldName, string>>;

const avatarStyles: Record<NeutralAvatarPreset, string> = {
  neutral: "bg-v2-surface-soft text-v2-text-secondary",
  blue: "bg-v2-primary-soft text-v2-primary",
  cyan: "bg-v2-cyan-soft text-v2-cyan-text",
  teal: "bg-v2-teal-soft text-v2-teal-text",
};

const avatarLabels: Record<NeutralAvatarPreset, string> = {
  neutral: "Нейтральный серо-синий",
  blue: "Синий",
  cyan: "Голубой",
  teal: "Бирюзовый",
};

export function ProfilePageContent() {
  const localProfile = useLocalProfile();
  const [draft, setDraft] = useState<LocalProfileData>(localProfile.profile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger" | "info"; title: string; description?: string } | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStorageAvailable(localProfileStorageAvailable()));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDraft(localProfile.profile);
      setErrors({});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [localProfile.profile]);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(localProfile.profile), [draft, localProfile.profile]);

  const setField = <Key extends FieldName>(field: Key, value: LocalProfileData[Key]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  };

  const validateDraft = () => {
    const nextErrors: FieldErrors = {};
    if (draft.displayName.trim().replace(/\s+/g, " ").length < 2) nextErrors.displayName = "Укажите отображаемое имя";
    if (draft.displayName.trim().length > 80) nextErrors.displayName = "Допустимо не более 80 символов";
    if (draft.jobTitle.trim().length > 80) nextErrors.jobTitle = "Допустимо не более 80 символов";
    if (draft.department.trim().length > 100) nextErrors.department = "Допустимо не более 100 символов";
    if (draft.contactEmail.trim().length > 160) nextErrors.contactEmail = "Допустимо не более 160 символов";
    if (draft.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())) nextErrors.contactEmail = "Укажите корректную контактную почту";
    if (!/^[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]{1,3}$/u.test(draft.initials.trim().toUpperCase())) nextErrors.initials = "Укажите от одной до трёх букв";
    if (!NEUTRAL_AVATAR_PRESETS.includes(draft.neutralAvatarPreset)) nextErrors.neutralAvatarPreset = "Выберите доступный нейтральный аватар";
    setErrors(nextErrors);
    return nextErrors;
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const nextErrors = validateDraft();
    if (Object.keys(nextErrors).length) {
      setFeedback({ tone: "danger", title: "Проверьте заполнение формы", description: "Исправьте отмеченные поля и повторите сохранение." });
      focusFirstError();
      return;
    }
    try {
      const normalized = validateLocalProfile(draft);
      localProfile.update(normalized);
      setDraft(normalized);
      setFeedback({ tone: "success", title: "Локальный профиль сохранён", description: "Имя и оформление профиля обновлены в этой вкладке и в боковой навигации." });
    } catch (error) {
      setFeedback({ tone: "danger", title: "Не удалось сохранить профиль", description: error instanceof Error ? error.message : "Повторите попытку." });
    }
  };

  const reset = () => {
    localProfile.reset();
    setDraft({ ...SYNTHETIC_PROFILE });
    setErrors({});
    setFeedback({ tone: "info", title: "Локальные изменения сброшены", description: "Восстановлен исходный синтетический профиль." });
  };

  const scrollToForm = () => document.getElementById("profile-edit")?.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });

  return (
    <div className="page-shell" data-testid="profile-page">
      <PageHeader
        eyebrow="Локальный профиль"
        title="Профиль пользователя"
        description="Отображаемая информация специалиста для работы с экспертной проверкой Verimed."
        secondaryActions={<Button variant="secondary" onClick={scrollToForm}><Pencil className="h-4 w-4" aria-hidden="true" />Редактировать профиль</Button>}
      />

      <DataPanel className="mb-5">
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <ProfileAvatar initials={localProfile.profile.initials} preset={localProfile.profile.neutralAvatarPreset} size="large" />
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-[-0.025em] text-v2-text md:text-3xl">{localProfile.profile.displayName}</p>
            <p className="mt-1 text-base text-v2-text-secondary">{localProfile.profile.jobTitle || "Должность не указана"}</p>
            <div className="mt-4 grid gap-3 border-t border-v2-border pt-4 sm:grid-cols-2">
              <ProfileFact label="Подразделение" value={localProfile.profile.department || "Не указано"} icon={<ClipboardCheck className="h-4 w-4" />} />
              <ProfileFact label="Контактная почта" value={localProfile.profile.contactEmail || "Не указана"} icon={<Mail className="h-4 w-4" />} />
            </div>
          </div>
        </div>
      </DataPanel>

      <InlineNotice
        className="mb-5"
        tone={storageAvailable ? "info" : "warning"}
        title={storageAvailable ? "Изменения сохраняются только в этом браузере" : "Локальное сохранение недоступно"}
        description={storageAvailable
          ? "Локальный профиль не изменяет учётную запись, права доступа или данные на сервере."
          : "Браузер запретил доступ к локальному хранилищу. Исходный синтетический профиль останется доступен."}
      />

      <section id="profile-edit" className="scroll-mt-24" aria-labelledby="profile-edit-title">
        <SectionHeader
          id="profile-edit-title"
          title="Редактирование отображения"
          description="Можно изменить только нейтральные сведения, которые используются в интерфейсе этого браузера."
        />
        <form className="mt-4" onSubmit={save} noValidate>
          <DataPanel>
            <div className="grid gap-5 md:grid-cols-2">
              <ProfileField label="Отображаемое имя" error={errors.displayName}>
                <Input
                  name="displayName"
                  aria-label="Отображаемое имя"
                  autoComplete="name"
                  maxLength={80}
                  value={draft.displayName}
                  aria-invalid={Boolean(errors.displayName)}
                  aria-describedby={errors.displayName ? "displayName-error" : undefined}
                  onChange={(event) => setField("displayName", event.target.value)}
                  required
                />
              </ProfileField>
              <ProfileField label="Должность" error={errors.jobTitle}>
                <Input
                  name="jobTitle"
                  aria-label="Должность"
                  autoComplete="organization-title"
                  maxLength={80}
                  value={draft.jobTitle}
                  aria-invalid={Boolean(errors.jobTitle)}
                  aria-describedby={errors.jobTitle ? "jobTitle-error" : undefined}
                  onChange={(event) => setField("jobTitle", event.target.value)}
                />
              </ProfileField>
              <ProfileField label="Подразделение" error={errors.department}>
                <Input
                  name="department"
                  aria-label="Подразделение"
                  autoComplete="organization"
                  maxLength={100}
                  value={draft.department}
                  aria-invalid={Boolean(errors.department)}
                  aria-describedby={errors.department ? "department-error" : undefined}
                  onChange={(event) => setField("department", event.target.value)}
                />
              </ProfileField>
              <ProfileField label="Контактная почта" error={errors.contactEmail}>
                <Input
                  name="contactEmail"
                  aria-label="Контактная почта"
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  value={draft.contactEmail}
                  aria-invalid={Boolean(errors.contactEmail)}
                  aria-describedby={errors.contactEmail ? "contactEmail-error" : undefined}
                  onChange={(event) => setField("contactEmail", event.target.value)}
                />
              </ProfileField>
              <ProfileField label="Инициалы" error={errors.initials} hint="От одной до трёх русских, казахских или латинских букв.">
                <Input
                  name="initials"
                  aria-label="Инициалы"
                  autoComplete="off"
                  maxLength={3}
                  value={draft.initials}
                  aria-invalid={Boolean(errors.initials)}
                  aria-describedby={errors.initials ? "initials-error" : "initials-hint"}
                  onChange={(event) => setField("initials", event.target.value.toUpperCase())}
                />
              </ProfileField>
              <ProfileField label="Нейтральный аватар" error={errors.neutralAvatarPreset}>
                <div className="flex items-center gap-3">
                  <ProfileAvatar initials={draft.initials || "—"} preset={draft.neutralAvatarPreset} />
                  <Select
                    name="neutralAvatarPreset"
                    aria-label="Нейтральный аватар"
                    value={draft.neutralAvatarPreset}
                    aria-invalid={Boolean(errors.neutralAvatarPreset)}
                    aria-describedby={errors.neutralAvatarPreset ? "neutralAvatarPreset-error" : undefined}
                    onChange={(event) => setField("neutralAvatarPreset", event.target.value as NeutralAvatarPreset)}
                  >
                    {NEUTRAL_AVATAR_PRESETS.map((preset) => <option key={preset} value={preset}>{avatarLabels[preset]}</option>)}
                  </Select>
                </div>
              </ProfileField>
            </div>

            {feedback && <InlineNotice className="mt-5" tone={feedback.tone} title={feedback.title} description={feedback.description} />}

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-v2-border pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="secondary" disabled={!storageAvailable || localProfile.source === "fallback"} onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Сбросить локальные изменения
              </Button>
              <Button type="submit" disabled={!storageAvailable || !changed}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Сохранить
              </Button>
            </div>
          </DataPanel>
        </form>
      </section>

      <section className="mt-6" aria-labelledby="profile-links-title">
        <SectionHeader id="profile-links-title" title="Рабочие разделы" description="Быстрые переходы к существующим сценариям экспертной работы." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ProfileLink href="/signals" label="Перейти к проверке" icon={ClipboardCheck} />
          <ProfileLink href="/decision-journal" label="Открыть журнал решений" icon={History} />
          <ProfileLink href="/reviews" label="Результаты экспертной оценки" icon={FileCheck2} />
          <ProfileLink href="/methodology" label="Открыть методику" icon={BookOpenCheck} />
        </div>
      </section>
    </div>
  );
}

function ProfileAvatar({ initials, preset, size = "default" }: { initials: string; preset: NeutralAvatarPreset; size?: "default" | "large" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-v2-border font-bold",
        size === "large" ? "h-24 w-24 text-2xl" : "h-12 w-12 text-sm",
        avatarStyles[preset],
      )}
      aria-label={`Нейтральный аватар, инициалы ${initials}`}
    >
      {initials || <UserRound className="h-5 w-5" aria-hidden="true" />}
    </span>
  );
}

function ProfileFact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary" aria-hidden="true">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold text-v2-text-secondary">{label}</p><p className="mt-1 break-words text-sm font-semibold text-v2-text">{value}</p></div></div>;
}

function ProfileField({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  const id = label === "Отображаемое имя" ? "displayName" : label === "Должность" ? "jobTitle" : label === "Подразделение" ? "department" : label === "Контактная почта" ? "contactEmail" : label === "Инициалы" ? "initials" : "neutralAvatarPreset";
  return (
    <label className="block text-sm font-semibold text-v2-text">
      {label}
      <span className="mt-2 block">{children}</span>
      {hint && !error && <span id={`${id}-hint`} className="mt-1 block text-xs font-normal leading-5 text-v2-text-secondary">{hint}</span>}
      {error && <span id={`${id}-error`} className="mt-1 block text-xs font-semibold text-v2-critical-text" role="alert">{error}</span>}
    </label>
  );
}

function ProfileLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof ClipboardCheck }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-v2-card border border-v2-border bg-v2-surface p-4 text-sm font-semibold text-v2-text transition-[background-color,border-color] duration-100 hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />
    </Link>
  );
}
