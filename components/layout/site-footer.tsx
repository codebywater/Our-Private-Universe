import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  const { year, month, day } = siteConfig.meetingDate;
  const dateLabel = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
  return (
    <footer className="relative z-10 border-t border-line px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center text-xs tracking-[0.2em] text-muted uppercase sm:flex-row sm:text-left">
        <p>{siteConfig.name}</p>
        <p>
          {siteConfig.coupleTitle} · с {dateLabel}
        </p>
      </div>
    </footer>
  );
}
