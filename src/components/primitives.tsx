"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 25V12a6 6 0 0 1 12 0v8a5 5 0 0 0 10 0V7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="6" cy="26" r="3" fill="currentColor" />
      <circle cx="28" cy="6" r="3" fill="currentColor" />
    </svg>
  );
}
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet-content"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <div className="sheet-handle" />
          <div className="sheet-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description
            className={description ? "sheet-description" : "sr-only"}
          >
            {description || title}
          </Dialog.Description>
          <div className="sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-action" onClick={onAction}>
          {action}
          <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Progress({
  value,
  label,
  className = "",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`progress ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${v}%` }} />
    </div>
  );
}
export function Landscape({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 230"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <rect width="600" height="230" fill="#e3e8dd" />
      <circle cx="430" cy="55" r="23" fill="#f8f1dc" />
      <path
        d="m0 150 61-57 50 27 80-100 52 79 42-24 56 65 71-55 38 39 82-72 68 59v119H0Z"
        fill="#b0beb1"
      />
      <path
        d="m115 116 76-96 52 79-28-12-15 5-12-37-20 42-21-2Z"
        fill="#e9eee4"
      />
      <path
        d="m0 193 93-59 94 37 102-51 79 40 97-30 135 57v43H0Z"
        fill="#648879"
      />
      <path
        d="m0 217 135-31 103 30 110-31 117 22 135-27v50H0Z"
        fill="#315a4b"
      />
      <path
        d="M318 230c-53-32 69-26 20-57"
        stroke="#d6ded2"
        strokeWidth="3"
        opacity=".65"
      />
      <path d="M0 225h600" stroke="#173d35" opacity=".1" />
    </svg>
  );
}
