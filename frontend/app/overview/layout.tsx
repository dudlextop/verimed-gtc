import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Аналитический обзор — Verimed",
  description: "Управленческий обзор результатов анализа медицинских услуг",
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
