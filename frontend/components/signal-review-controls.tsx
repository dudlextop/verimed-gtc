"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, FileQuestion, PlayCircle, Send, X } from "lucide-react";
import type { ReviewStatus } from "@/lib/types";
import { Button, Card, OverflowActions, Select, Textarea } from "./foundation";

export type ReviewChoice = { status: ReviewStatus; commentOnly?: boolean };

export function ReviewActions({ currentStatus, onChoose, includeStart = false, className = "" }: { currentStatus: ReviewStatus; onChoose: (choice: ReviewChoice) => void; includeStart?: boolean; className?: string }) {
  const secondaryActions = [
    { id: "confirm", label: "Подтвердить сигнал", icon: <Check className="h-4 w-4"/>, onSelect: () => onChoose({ status: "Подтверждён сигнал" }) },
    { id: "reject", label: "Отклонить сигнал", icon: <X className="h-4 w-4"/>, onSelect: () => onChoose({ status: "Сигнал не подтверждён" }) },
    ...(includeStart && currentStatus !== "На рассмотрении" ? [{ id: "start", label: "Начать проверку", icon: <PlayCircle className="h-4 w-4"/>, onSelect: () => onChoose({ status: "На рассмотрении" as const }) }] : []),
    { id: "request", label: "Запросить сведения", icon: <FileQuestion className="h-4 w-4"/>, onSelect: () => onChoose({ status: "Требуются дополнительные сведения" }) },
  ];
  return <div className={`flex min-w-0 items-center justify-end gap-2 ${className}`} aria-label="Действия специалиста">
    <Button onClick={() => onChoose({ status: "Направлено на углублённую проверку" })} className="min-w-0 flex-1 max-sm:px-2 max-sm:text-xs sm:flex-none"><Send className="h-4 w-4 shrink-0 max-sm:hidden" aria-hidden="true"/><span className="truncate">Направить на углублённую проверку</span></Button>
    <OverflowActions compactOnMobile placement="top" label="Другие действия" items={secondaryActions}/>
  </div>;
}

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function ReviewDialog({ choice, saving, onCancel, onSave, initialComment = "" }: { choice: ReviewChoice; saving: boolean; onCancel: () => void; onSave: (comment: string, reasonCode: string) => void; initialComment?: string }) {
  const [comment, setComment] = useState(initialComment);
  const reasons = choice.status === "На рассмотрении" ? ["проверка начата"] : choice.status === "Сигнал не подтверждён" ? ["медицински обоснованная услуга", "неполные исходные данные", "ошибка исходных данных", "допустимое организационное отклонение", "недостаточная сопоставимая группа", "сигнал сформирован ошибочно", "иная причина"] : choice.status === "Направлено на углублённую проверку" || choice.status === "Требуются дополнительные сведения" ? ["требуется запрос документов", "требуется клиническая экспертиза", "требуется проверка организации", "требуется проверка связанных сигналов", "требуется дополнительная выборка данных", "иная причина"] : ["данные подтверждают отклонение", "повторяемость требует дополнительного внимания", "существенная финансовая значимость", "подтверждено сопоставлением с документами", "подтверждено медицинским экспертом", "иная причина"];
  const [reason, setReason] = useState(reasons[0]);
  const titleId = useId();
  const commentId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const commentRequired = choice.status === "Сигнал не подтверждён" || reason === "иная причина";

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      previousFocus?.focus();
    };
  }, [onCancel]);

  const explanation = choice.commentOnly
    ? "Комментарий будет добавлен в историю без изменения текущего статуса."
    : choice.status === "Подтверждён сигнал"
      ? "Сигнал останется в истории как подтверждённый специалистом и будет учтён в результатах проверок."
      : choice.status === "Сигнал не подтверждён"
        ? "Сигнал будет отмечен как не подтверждённый. Укажите основание решения."
        : choice.status === "На рассмотрении"
          ? "Сигнал будет отмечен как находящийся на рассмотрении."
          : "Сигнал получит повышенный приоритет для дополнительной экспертной проверки.";

  return <div className="fixed inset-0 z-[70] grid place-items-center p-4">
    <button type="button" className="absolute inset-0 bg-v2-overlay" aria-label="Закрыть окно решения" onClick={onCancel}/>
    <div ref={dialogRef} className="relative w-full max-w-lg"><Card role="dialog" aria-modal="true" aria-labelledby={titleId} variant="elevated" className="p-5 sm:p-6">
      <h2 id={titleId} className="text-xl font-bold text-v2-text">{choice.commentOnly ? "Добавить комментарий" : "Подтвердить решение"}</h2>
      {!choice.commentOnly && <p className="mt-2 text-sm">Новый статус: <strong>{choice.status}</strong></p>}
      <p className="mt-2 text-sm leading-6 text-v2-text-secondary">{explanation}</p>
      <label className="mt-5 block text-sm font-semibold">Причина решения<Select className="mt-2 w-full" value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label htmlFor={commentId} className="mt-5 block text-sm font-semibold">Комментарий специалиста{commentRequired ? " — обязательно" : ""}</label>
      <Textarea id={commentId} value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} aria-required={commentRequired} className="mt-2" placeholder="Укажите медицинский или организационный контекст решения"/>
      {commentRequired && !comment.trim() && <p className="mt-2 text-xs text-v2-text-secondary">Для этого решения требуется краткое обоснование.</p>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel} disabled={saving}>Отмена</Button><Button onClick={() => onSave(comment.trim(), reason)} disabled={saving || (commentRequired && !comment.trim())} loading={saving}>{choice.commentOnly ? "Добавить комментарий" : "Сохранить решение"}</Button></div>
    </Card></div>
  </div>;
}
