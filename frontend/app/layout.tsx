import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Verimed — контроль медицинских услуг", description: "Интеллектуальная система прозрачности и контроля медицинских услуг" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body><AppShell>{children}</AppShell></body></html> }
