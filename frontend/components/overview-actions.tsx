"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Minimize2, Printer } from "lucide-react";
import { Button, OverflowActions } from "@/components/foundation";

export function OverviewActions() {
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const fullscreenTrigger = useRef<HTMLButtonElement | null>(null);
  const wasFullscreen = useRef(false);

  useEffect(() => {
    const update = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (wasFullscreen.current && !active) fullscreenTrigger.current?.focus();
      wasFullscreen.current = active;
    };
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = async () => {
    setMessage("");
    if (!document.documentElement.requestFullscreen) {
      setMessage("Полноэкранный режим недоступен в этом браузере.");
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setMessage("Не удалось развернуть обзор. Используйте полноэкранный режим браузера.");
    }
  };

  const print = () => window.print();

  return (
    <div className="relative flex items-center gap-1 print:hidden">
      <div className="hidden items-center gap-1 sm:flex">
        <Button type="button" variant="ghost" size="icon" onClick={print} aria-label="Печать аналитического обзора" title="Печать">
          <Printer className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          ref={fullscreenTrigger}
          type="button"
          variant="secondary"
          size="compact"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Выйти из полноэкранного режима" : "Развернуть аналитический обзор"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Expand className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden lg:inline">{fullscreen ? "Свернуть обзор" : "Развернуть обзор"}</span>
        </Button>
      </div>
      <div className="sm:hidden">
        <OverflowActions
          iconOnly
          label="Действия аналитического обзора"
          items={[
            { id: "print", label: "Печать", icon: <Printer className="h-4 w-4" />, onSelect: print },
            { id: "fullscreen", label: fullscreen ? "Свернуть обзор" : "Развернуть обзор", icon: fullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />, onSelect: toggleFullscreen },
          ]}
        />
      </div>
      <span className="sr-only" aria-live="polite">{message}</span>
      {message && <span className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-72 rounded-v2-control border border-v2-warning/20 bg-v2-warning-soft px-3 py-2 text-xs leading-5 text-v2-warning-text shadow-v2-dropdown" role="status">{message}</span>}
    </div>
  );
}
