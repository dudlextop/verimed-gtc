"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, FileQuestion, MessageSquareText, SearchCheck, Send } from "lucide-react";
import type { PatternReviewStatus } from "@/lib/types";
import { Button, Card, OverflowActions, Select, Textarea } from "./foundation";

type PatternChoice = { status: PatternReviewStatus; commentOnly?: boolean };

export function PatternReviewActions({ currentStatus, onChoose, nextHref }: { currentStatus: PatternReviewStatus; onChoose: (choice: PatternChoice) => void; nextHref?: string }) {
  const secondaryActions = [
    ...(nextHref ? [{ id: "deep-review", label: "Направить на углублённую проверку", icon: <Send className="h-4 w-4" />, onSelect: () => onChoose({ status: "Направлено на углублённую проверку" as const }) }] : []),
    { id: "confirm", label: "Подтвердить значимость", icon: <CheckCircle2 className="h-4 w-4" />, onSelect: () => onChoose({ status: "Значимость подтверждена" as const }) },
    { id: "insignificant", label: "Признать несущественной", icon: <SearchCheck className="h-4 w-4" />, onSelect: () => onChoose({ status: "Отмечено как несущественное" as const }) },
    { id: "request", label: "Запросить сведения", icon: <FileQuestion className="h-4 w-4" />, onSelect: () => onChoose({ status: "Требуются дополнительные сведения" as const }) },
    { id: "comment", label: "Добавить комментарий", icon: <MessageSquareText className="h-4 w-4" />, onSelect: () => onChoose({ status: currentStatus, commentOnly: true }) },
  ];

  return <div className="flex min-w-0 items-center justify-end gap-2" aria-label="Экспертная оценка модели">
    {nextHref
      ? <Button asChild className="min-w-0 flex-1 sm:flex-none"><Link href={nextHref}>Перейти к следующей модели<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link></Button>
      : <Button onClick={() => onChoose({ status: "Направлено на углублённую проверку" })} className="min-w-0 flex-1 max-sm:px-2 max-sm:text-xs sm:flex-none"><Send className="h-4 w-4 shrink-0 max-sm:hidden" aria-hidden="true" /><span className="truncate">Направить на углублённую проверку</span></Button>}
    <OverflowActions compactOnMobile placement="top" label="Другие действия" items={secondaryActions} />
  </div>;
}

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function PatternReviewDialog({ choice, saving, onCancel, onSave }: { choice: PatternChoice; saving: boolean; onCancel: () => void; onSave: (comment: string, reasonCode: string) => void }) {
  const [comment, setComment] = useState("");
  const reasons = choice.status === "Отмечено как несущественное"
    ? ["допустимое организационное отклонение", "неполные исходные данные", "недостаточная сопоставимая группа", "иная причина"]
    : choice.status === "Направлено на углублённую проверку" || choice.status === "Требуются дополнительные сведения"
      ? ["требуется запрос документов", "требуется проверка организации", "требуется проверка связанных сигналов", "требуется дополнительная выборка данных", "иная причина"]
      : ["данные подтверждают отклонение", "повторяемость требует дополнительного внимания", "существенная финансовая значимость", "подтверждено сопоставлением с документами", "подтверждено медицинским экспертом", "иная причина"];
  const [reason, setReason] = useState(reasons[0]);
  const titleId = useId();
  const commentId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const required = choice.status === "Отмечено как несущественное" || reason === "иная причина";

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onCancel]);

  const explanation = choice.commentOnly
    ? "Комментарий будет добавлен в историю без изменения статуса модели."
    : choice.status === "Значимость подтверждена"
      ? "Модель останется в рабочем списке как значимая для экспертной проверки."
      : choice.status === "Отмечено как несущественное"
        ? "Модель будет отмечена как несущественная для текущего контекста. Добавьте основание решения."
        : "Модель будет направлена на углублённую экспертную проверку вместе со связанными сигналами.";

  return <div className="fixed inset-0 z-[80] grid place-items-center p-4">
    <button type="button" className="absolute inset-0 bg-v2-overlay" onClick={onCancel} aria-label="Закрыть окно оценки" />
    <div ref={dialogRef} className="relative w-full max-w-lg">
      <Card role="dialog" aria-modal="true" aria-labelledby={titleId} variant="elevated" className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-bold text-v2-text">{choice.commentOnly ? "Добавить комментарий" : "Подтвердить экспертную оценку"}</h2>
        {!choice.commentOnly && <p className="mt-2 text-sm">Новый статус: <strong>{choice.status}</strong></p>}
        <p className="mt-2 text-sm leading-6 text-v2-text-secondary">{explanation}</p>
        <label className="mt-5 block text-sm font-semibold">Причина решения<Select className="mt-2 w-full" value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label htmlFor={commentId} className="mt-5 block text-sm font-semibold">Комментарий специалиста{required ? " — обязательно" : ""}</label>
        <Textarea id={commentId} value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} aria-required={required} className="mt-2" placeholder="Укажите медицинский или организационный контекст" />
        {required && !comment.trim() && <p className="mt-2 text-xs text-v2-text-secondary">Для этого решения требуется краткое обоснование.</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={onCancel}>Отмена</Button><Button disabled={saving || (required && !comment.trim())} loading={saving} onClick={() => onSave(comment.trim(), reason)}>{choice.commentOnly ? "Добавить комментарий" : "Сохранить оценку"}</Button></div>
      </Card>
    </div>
  </div>;
}

export type { PatternChoice };
