"use client";

import { AlertCircle, DatabaseZap } from "lucide-react";
import { Button, Card, Skeleton } from "./ui";

export function PageLoading() {
  return <div className="space-y-5" aria-label="Загрузка данных" aria-busy="true"><Skeleton className="h-24"/><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32"/><Skeleton className="h-32"/><Skeleton className="h-32"/></div><Skeleton className="h-72"/></div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const safeMessage = /fetch|network/i.test(message) ? "Не удалось связаться с сервисом. Проверьте соединение и повторите попытку." : message;
  return <Card className="flex min-h-44 flex-col items-start justify-center gap-3 border-danger/15 bg-danger-soft p-5"><span className="grid h-10 w-10 place-items-center rounded-full bg-card text-danger shadow-sm"><AlertCircle className="h-5 w-5" aria-hidden="true"/></span><div><h2 className="font-bold">Не удалось получить данные</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{safeMessage}</p></div><Button variant="outline" onClick={retry}>Повторить</Button></Card>;
}

export function EmptyState({ title = "Нет данных по выбранным условиям", description = "Измените фильтры или повторите попытку позже.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong/80 bg-surface-soft/60 px-5 py-8 text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-sm"><DatabaseZap className="h-5 w-5" aria-hidden="true"/></span><div><p className="font-bold">{title}</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}
