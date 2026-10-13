"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  /** Запретить закрытие (например, во время загрузки). */
  dismissible?: boolean;
  children: React.ReactNode;
  className?: string;
};

const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

/**
 * Доступное модальное окно на нативном <dialog>: фокус удерживается внутри,
 * Esc закрывает, фон неактивен — без самописной ловушки фокуса.
 * На телефонах открывается «шторкой» снизу.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  dismissible = true,
  children,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="modal fixed inset-0 m-0 h-full max-h-none w-full max-w-none"
      onCancel={(e) => {
        // Esc
        if (!dismissible) e.preventDefault();
      }}
      onClose={() => {
        document.body.style.overflow = "";
        onClose();
      }}
    >
      <div
        className="flex h-full w-full items-end justify-center p-0 sm:items-center sm:p-6"
        onMouseDown={(e) => {
          if (dismissible && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={cn(
            "panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-ink-2/95 shadow-2xl sm:rounded-3xl",
            widths[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-display text-2xl font-light leading-tight text-text"
              >
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="overflow-y-auto px-6 py-6">{open ? children : null}</div>
        </div>
      </div>
    </dialog>
  );
}
