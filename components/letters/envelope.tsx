"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/** Конверт: закрытый (запечатан / не открыт) или с открывающимся клапаном. */
export function Envelope({
  open = false,
  sealed = false,
  className,
}: {
  open?: boolean;
  sealed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-[3/2] w-full", className)} aria-hidden="true">
      <div className="absolute inset-0 rounded-xl border border-line-strong bg-gradient-to-b from-ink-2 to-ink" />
      {/* письмо внутри */}
      <motion.div
        className="absolute inset-x-[10%] top-[8%] h-[70%] rounded-md bg-text/90"
        initial={false}
        animate={{ y: open ? "-38%" : "0%" }}
        transition={{ duration: 0.9, delay: open ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* нижние грани */}
      <svg viewBox="0 0 300 200" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <path d="M0 200 L150 90 L300 200 Z" className="fill-ink-2" stroke="rgb(198 168 247 / 0.25)" />
        <path d="M0 0 L150 110 L0 200 Z" className="fill-ink-2" stroke="rgb(198 168 247 / 0.2)" />
        <path d="M300 0 L150 110 L300 200 Z" className="fill-ink-2" stroke="rgb(198 168 247 / 0.2)" />
      </svg>
      {/* клапан */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 origin-top"
        style={{ transformPerspective: 800 }}
        initial={false}
        animate={{ rotateX: open ? 180 : 0, zIndex: open ? 0 : 3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg viewBox="0 0 300 100" className="size-full" preserveAspectRatio="none">
          <path d="M0 0 L150 100 L300 0 Z" className="fill-ink-2" stroke="rgb(198 168 247 / 0.35)" />
        </svg>
      </motion.div>
      {/* печать */}
      <motion.div
        className={cn(
          "absolute left-1/2 top-[44%] z-[4] grid size-10 -translate-x-1/2 place-items-center rounded-full font-display text-sm",
          sealed ? "bg-accent text-ink glow-accent" : "bg-accent/60 text-ink",
        )}
        initial={false}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.6 : 1 }}
        transition={{ duration: 0.3 }}
      >
        G×K
      </motion.div>
    </div>
  );
}
