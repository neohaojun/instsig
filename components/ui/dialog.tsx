"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("Dialog components must be used within <Dialog />");
  return context;
}

function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return <DialogContext.Provider value={{ open, setOpen: onOpenChange, triggerRef }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ children, asChild = false }: { children: React.ReactElement; asChild?: boolean }) {
  const { setOpen, triggerRef } = useDialog();
  if (!asChild) return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
  const child = children as React.ReactElement<any>;
  return React.cloneElement(child, {
    ref: triggerRef,
    "aria-haspopup": "dialog",
    onClick: (event: React.MouseEvent) => {
      child.props.onClick?.(event);
      if (!event.defaultPrevented) setOpen(true);
    },
  });
}

function DialogContent({
  children,
  className,
  dismissible = true,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
  "aria-labelledby"?: string;
}) {
  const { open, setOpen, triggerRef } = useDialog();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const setOpenRef = React.useRef(setOpen);
  const [mounted, setMounted] = React.useState(false);

  setOpenRef.current = setOpen;

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const triggerElement = triggerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      first?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        setOpenRef.current(false);
        return;
      }
      if (event.key !== "Tab" || !contentRef.current) return;
      const focusable = Array.from(contentRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [dismissible, open, triggerRef]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={(event) => {
          if (dismissible && event.target === event.currentTarget) setOpen(false);
        }}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export { Dialog, DialogContent, DialogTrigger };
