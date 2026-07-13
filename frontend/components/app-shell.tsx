"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === "/overview";

  return <>
    {!isOverview && <Sidebar/>}
    <main className={cn(
      "min-h-screen min-w-0 max-w-full overflow-x-clip",
      isOverview ? "overview-main" : "pt-16 lg:ml-[17rem] lg:pt-0",
    )}>
      {children}
    </main>
  </>;
}
