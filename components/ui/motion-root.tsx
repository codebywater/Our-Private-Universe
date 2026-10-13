"use client";

import { MotionConfig } from "framer-motion";

/**
 * Глобально уважает prefers-reduced-motion: при включённой настройке
 * Framer Motion отключает transform/layout-анимации.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
