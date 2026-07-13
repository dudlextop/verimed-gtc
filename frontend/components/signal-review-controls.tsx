"use client";

import { useEffect, useId, useState } from "react";
import { Check, FileQuestion, PlayCircle, Send, X } from "lucide-react";
import type { ReviewStatus } from "@/lib/types";
import { Button, Card, Select } from "./ui";

export type ReviewChoice = { status: ReviewStatus; commentOnly?: boolean };

export function ReviewActions({ currentStatus, onChoose, includeStart = false, className = "" }: { currentStatus: ReviewStatus; onChoose: (choice: ReviewChoice) => void; includeStart?: boolean; className?: string }) {
  return <div className={`flex items-center justify-end gap-2 ${className}`} aria-label="Действия специалиста">
    <Button onClick={() => onChoose({status: "Направлено на углублённую проверку"})} className="min-w-0 flex-1 sm:flex-none"><Send className="h-4 w-4" aria-hidden="true"/>Направить на углублённую проверку</Button>
    <details className="group relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center rounded-md bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Другие действия</summary>
      <div className="absolute bottom-full right-0 z-50 mb-2 hidden w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-card p-3 shadow-xl group-open:block">
        <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Решение</p>
        <div className="space-y-1"><Button className="w-full justify-start" variant="ghost" onClick={() => onChoose({status: "Подтверждён сигнал"})}><Check className="h-4 w-4" aria-hidden="true"/>Подтвердить сигнал</Button><Button className="w-full justify-start" variant="ghost" onClick={() => onChoose({status: "Сигнал не подтверждён"})}><X className="h-4 w-4" aria-hidden="true"/>Отклонить сигнал</Button></div>
        <div className="mt-2 space-y-1 border-t pt-2">{includeStart && <Button className="w-full justify-start" variant="ghost" onClick={() => onChoose({status: "На рассмотрении"})} disabled={currentStatus === "На рассмотрении"}><PlayCircle className="h-4 w-4" aria-hidden="true"/>Начать проверку</Button>}<Button className="w-full justify-start" variant="ghost" onClick={() => onChoose({status: "Требуются дополнительные сведения"})}><FileQuestion className="h-4 w-4" aria-hidden="true"/>Запросить сведения</Button></div>
      </div>
    </details>
  </div>;
}

export function ReviewDialog({ choice, saving, onCancel, onSave, initialComment = "" }: { choice: ReviewChoice; saving: boolean; onCancel: () => void; onSave: (comment: string, reasonCode: string) => void; initialComment?: string }) {
  const [comment, setComment] = useState(initialComment);
  const reasons = choice.status === "На рассмотрении" ? ["проверка начата"] : choice.status === "Сигнал не подтверждён" ? ["медицински обоснованная услуга", "неполные исходные данные", "ошибка исходных данных", "допустимое организационное отклонение", "недостаточная сопоставимая группа", "сигнал сформирован ошибочно", "иная причина"] : choice.status === "Направлено на углублённую проверку" || choice.status === "Требуются дополнительные сведения" ? ["требуется запрос документов", "требуется клиническая экспертиза", "требуется проверка организации", "требуется проверка связанных сигналов", "требуется дополнительная выборка данных", "иная причина"] : ["данные подтверждают отклонение", "повторяемость требует дополнительного внимания", "существенная финансовая значимость", "подтверждено сопоставлением с документами", "подтверждено медицинским экспертом", "иная причина"];
  const [reason, setReason] = useState(reasons[0]);
  const titleId = useId();
  const commentId = useId();
  const commentRequired = choice.status === "Сигнал не подтверждён" || reason === "иная причина";
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
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
    <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" aria-label="Закрыть окно решения" onClick={onCancel}/>
    <Card role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg p-6 shadow-xl">
      <h2 id={titleId} className="text-xl font-bold">{choice.commentOnly ? "Добавить комментарий" : "Подтвердить решение"}</h2>
      {!choice.commentOnly && <p className="mt-2 text-sm">Новый статус: <strong>{choice.status}</strong></p>}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{explanation}</p>
      <label className="mt-5 block text-sm font-semibold">Причина решения<Select className="mt-2 w-full" value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label htmlFor={commentId} className="mt-5 block text-sm font-semibold">Комментарий специалиста{commentRequired ? " — обязательно" : ""}</label>
      <textarea id={commentId} value={comment} onChange={event => setComment(event.target.value)} rows={4} maxLength={2000} aria-required={commentRequired} className="mt-2 w-full rounded-md border bg-card p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1" placeholder="Укажите медицинский или организационный контекст решения"/>
      {commentRequired && !comment.trim() && <p className="mt-2 text-xs text-muted-foreground">Для этого решения требуется краткое обоснование.</p>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel} disabled={saving}>Отмена</Button><Button onClick={() => onSave(comment.trim(), reason)} disabled={saving || (commentRequired && !comment.trim())} aria-busy={saving}>{saving ? "Сохранение…" : choice.commentOnly ? "Добавить комментарий" : "Сохранить решение"}</Button></div>
    </Card>
  </div>;
}
