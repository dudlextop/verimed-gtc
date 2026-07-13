"use client";

import { useEffect, useState } from "react";

export function useNearViewport(rootMargin = "500px") {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);
  return { ref: setNode, near };
}
