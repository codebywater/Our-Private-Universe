"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl font-light italic text-text">Что-то пошло не так</h1>
      <p className="mt-4 text-muted">Попробуйте обновить страницу.</p>
      <Button className="mt-8" onClick={reset}>Повторить</Button>
    </main>
  );
}
