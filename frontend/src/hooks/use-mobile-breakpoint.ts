"use client";

import { useSyncExternalStore } from "react";

const BREAKPOINT_QUERY = "(max-width: 768px)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(BREAKPOINT_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(BREAKPOINT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useMobileBreakpoint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
