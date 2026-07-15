"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === "/overview";

  return (
    <>
      {!isOverview && (
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-v2-control bg-v2-primary px-4 py-2.5 text-sm font-semibold text-white shadow-v2-dropdown focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface motion-reduce:transition-none"
        >
          К основному содержанию
        </a>
      )}
      {!isOverview && <Sidebar />}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-[100dvh] min-w-0 max-w-full overflow-x-clip",
          isOverview ? "overview-main" : "bg-v2-canvas pt-16 text-v2-text xl:ml-[16.5rem] xl:pt-0",
        )}
      >
        {children}
      </main>
    </>
  );
}
