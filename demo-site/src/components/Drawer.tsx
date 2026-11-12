"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { IconButton } from "./ui";

/** 右側抽屜（手機全寬），新增／修改表單共用 */
export default function Drawer({
  open, title, onClose, footer, children, testId,
}: { open: boolean; title: string; onClose: () => void; footer?: ReactNode; children: ReactNode; testId: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
      <div className="absolute inset-0 bg-neutral-900/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <IconButton label="關閉" onClick={onClose} data-testid={`${testId}-close-btn`}>
            <X size={22} strokeWidth={1.75} aria-hidden />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
