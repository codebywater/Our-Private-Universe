import { cn } from "@/lib/utils/cn";

export const controlClasses =
  "w-full rounded-xl border border-line-strong bg-white/[0.04] px-4 text-base text-text placeholder:text-muted/70 transition duration-200 focus:border-accent/70 focus:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 aria-[invalid=true]:border-danger/70";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, "h-12", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlClasses, "min-h-28 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-[0.18em] text-muted"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
