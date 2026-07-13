"use client";

import { useEffect, useState } from "react";
import { Expand, Minimize2, Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function OverviewActions() {
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
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

  return <div className="overview-utility-actions print:hidden">
    <Button type="button" variant="ghost" size="icon" onClick={() => window.print()} aria-label="Печать аналитического обзора" title="Печать">
      <Printer className="h-4 w-4" aria-hidden="true"/>
    </Button>
    <Button type="button" variant="ghost" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Выйти из полноэкранного режима" : "Развернуть аналитический обзор"}>
      {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true"/> : <Expand className="h-4 w-4" aria-hidden="true"/>}
      <span className="hidden sm:inline">{fullscreen ? "Свернуть обзор" : "Развернуть обзор"}</span>
    </Button>
    <span className="sr-only" aria-live="polite">{message}</span>
    {message && <span className="overview-fullscreen-message" role="status">{message}</span>}
  </div>;
}
