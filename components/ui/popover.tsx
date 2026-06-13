"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type PopoverContextValue = {
  open: boolean;
  setOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within <Popover />");
  }
  return context;
}

function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      const nextValue = typeof value === "function" ? value(open) : value;
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextValue);
      }
      onOpenChange?.(nextValue);
    },
    [controlledOpen, onOpenChange, open],
  );

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative w-full">{children}</div>
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  children,
  asChild = false,
}: {
  children: React.ReactElement;
  asChild?: boolean;
}) {
  const { open, setOpen, triggerRef } = usePopoverContext();

  if (!asChild) {
    return (
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
    );
  }

  const child = children as React.ReactElement<any>;

  return React.cloneElement(child, {
    ref: triggerRef,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onClick: (event: React.MouseEvent) => {
      child.props.onClick?.(event);
      if (!event.defaultPrevented) setOpen((value) => !value);
    },
  });
}

function PopoverContent({
  className,
  align = "start",
  children,
}: {
  className?: string;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const { open, contentRef } = usePopoverContext();

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="dialog"
      className={cn(
        "absolute top-full z-50 mt-2 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-soft",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
