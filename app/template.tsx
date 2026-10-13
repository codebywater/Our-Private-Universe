"use client";

import { motion } from "framer-motion";

/**
 * Плавный переход между страницами: template пересоздаётся при каждой
 * навигации, поэтому содержимое мягко проявляется. При prefers-reduced-motion
 * движение отключается через MotionConfig.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
