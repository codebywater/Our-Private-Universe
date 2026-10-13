"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogIn, LogOut, Lock, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Monogram } from "@/components/hero/logo";
import { cn } from "@/lib/utils/cn";
import { navItems } from "@/lib/site-config";

type SiteNavProps = {
  signedIn: boolean;
  displayName?: string;
  signOutAction: () => Promise<void>;
};

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith("/#")) return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ signedIn, displayName, signOutAction }: SiteNavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Меню считается открытым только на той странице, где его открыли:
  // при переходе (смене pathname) оно закрывается без setState в эффекте.
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const menuOpen = menu.open && menu.path === pathname;
  const setMenuOpen = (open: boolean) => setMenu({ open, path: pathname });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Меню: Esc закрывает, фокус уходит внутрь и возвращается на кнопку
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    const button = menuButtonRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu({ open: false, path: pathname });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [menuOpen, pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500",
        scrolled || menuOpen
          ? "border-b border-line bg-ink/75 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:h-20 sm:px-8">
        <Link
          href="/"
          aria-label="Гриша и Катя — на главную"
          className="shrink-0 rounded-full"
        >
          <Monogram size="sm" />
        </Link>

        <nav aria-label="Основная навигация" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={signedIn || !item.private ? undefined : false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm tracking-wide transition-colors",
                      active ? "text-text" : "text-muted hover:text-text",
                    )}
                  >
                    {item.label}
                    {active ? (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-4 -bottom-0.5 h-px bg-accent"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted xl:inline-flex"
            title={signedIn ? "Вы вошли: доступ открыт" : "Доступ закрыт: нужен вход"}
          >
            <Lock className="size-3.5 text-accent" aria-hidden="true" />
            {signedIn ? "Доступ открыт" : "Закрытый доступ"}
          </span>
          {signedIn ? (
            <form action={signOutAction} className="hidden lg:block">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm text-muted transition hover:border-accent/60 hover:text-text"
                aria-label={displayName ? `Выйти (${displayName})` : "Выйти"}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Выйти
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="hidden h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm text-muted transition hover:border-accent/60 hover:text-text lg:inline-flex"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Войти
            </Link>
          )}

          <button
            ref={menuButtonRef}
            type="button"
            className="grid size-11 place-items-center rounded-full border border-line-strong text-text lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100dvh - 4rem)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden lg:hidden"
          >
            <nav aria-label="Мобильная навигация" className="flex h-full flex-col px-5 pb-10 pt-6">
              <ul className="flex flex-col">
                {navItems.map((item, i) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href} className="border-b border-line">
                      <Link
                        ref={i === 0 ? firstLinkRef : undefined}
                        href={item.href}
                        prefetch={signedIn || !item.private ? undefined : false}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-baseline justify-between py-5 font-display text-4xl font-light",
                          active ? "text-accent" : "text-text",
                        )}
                      >
                        {item.label}
                        <span className="text-xs tracking-[0.3em] text-muted">
                          0{i + 1}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto pt-8">
                {signedIn ? (
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-text"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Выйти{displayName ? ` · ${displayName}` : ""}
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-ink"
                  >
                    <LogIn className="size-4" aria-hidden="true" />
                    Войти
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
