import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-accent">404</p>
      <h1 className="mt-4 font-display text-5xl font-light italic text-text text-glow">Такой страницы нет</h1>
      <Link href="/" className={buttonClasses({ className: "mt-8" })}>На главную</Link>
    </main>
  );
}
