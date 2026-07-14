"use client";

import { Button, EmptyState, PageSkeleton } from "./ui";

export function PageLoading() {
  return <PageSkeleton variant="dashboard" />;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const safeMessage = /fetch|network/i.test(message) ? "Не удалось связаться с сервисом. Проверьте соединение и повторите попытку." : message;
  return <EmptyState variant="error" title="Не удалось получить данные" description={safeMessage} action={<Button variant="secondary" onClick={retry}>Повторить</Button>} />;
}

export function EmptyDataState({ title = "Нет данных по выбранным условиям", description = "Измените фильтры или повторите попытку позже.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return <EmptyState title={title} description={description} action={action} />;
}

export { EmptyState };
