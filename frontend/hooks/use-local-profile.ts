"use client";

import * as React from "react";
import {
  LOCAL_PROFILE_CHANGE_EVENT,
  LOCAL_PROFILE_KEY,
  readLocalProfile,
  resetLocalProfile,
  saveLocalProfile,
  type LocalProfileData,
  type LocalProfileReadResult,
} from "@/lib/local-profile";

export function useLocalProfile() {
  const [result, setResult] = React.useState<LocalProfileReadResult>(() => readLocalProfile(null));

  React.useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => setResult(readLocalProfile()));
    const synchronize = (event: StorageEvent) => {
      if (event.key === LOCAL_PROFILE_KEY || event.key === null) setResult(readLocalProfile());
    };
    const synchronizeCurrentTab = () => setResult(readLocalProfile());
    window.addEventListener("storage", synchronize);
    window.addEventListener(LOCAL_PROFILE_CHANGE_EVENT, synchronizeCurrentTab);
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      window.removeEventListener("storage", synchronize);
      window.removeEventListener(LOCAL_PROFILE_CHANGE_EVENT, synchronizeCurrentTab);
    };
  }, []);

  const update = React.useCallback((data: Partial<LocalProfileData>) => {
    const envelope = saveLocalProfile(data);
    setResult({ profile: envelope.data, updatedAt: envelope.updatedAt, source: "local" });
  }, []);

  const reset = React.useCallback(() => setResult(resetLocalProfile()), []);

  return { ...result, update, reset };
}
