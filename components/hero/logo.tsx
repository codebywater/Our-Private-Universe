import { cn } from "@/lib/utils/cn";
import { siteConfig } from "@/lib/site-config";

/**
 * Монограмма (siteConfig.monogram): тонкое кольцо, серифные буквы и знак «×» акцентным цветом.
 */
export function Monogram({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = {
    sm: "size-11 text-sm",
    md: "size-16 text-lg",
    lg: "size-24 text-3xl",
  }[size];

  return (
    <span
      role="img"
      aria-label={siteConfig.monogram}
      className={cn(
        "relative inline-grid place-items-center rounded-full border border-line-strong bg-white/[0.03] font-display font-light tracking-wider text-text backdrop-blur",
        dims,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-1 rounded-full border border-accent/30"
      />
      <span aria-hidden="true" className="relative flex items-center gap-[0.35em]">
        <span>G</span>
        <span className="text-accent">×</span>
        <span>K</span>
      </span>
    </span>
  );
}
