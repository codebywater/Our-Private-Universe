"use client";

import { Button } from "@/components/ui/button";

export default function TimelineError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl font-light italic text-text">Не удалось открыть хронологию</h1>
      <p className="mt-4 text-muted">Что-то пошло не так. Попробуйте ещё раз чуть позже.</p>
      <Button className="mt-8" onClick={reset}>Повторить</Button>
    </main>
  );
}
