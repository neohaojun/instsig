"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const storageKey = "instsig-theme";

type Theme = "dark" | "light";
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

function setThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#0a0a0a");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyTheme(theme: Theme, animate = false) {
  if (!animate || prefersReducedMotion()) {
    setThemeClass(theme);
    return;
  }

  const root = document.documentElement;
  const transitionDocument = document as ViewTransitionDocument;

  root.classList.add("theme-transitioning");

  if (transitionDocument.startViewTransition) {
    const transition = transitionDocument.startViewTransition(() => setThemeClass(theme));
    transition.finished.finally(() => root.classList.remove("theme-transitioning"));
    return;
  }

  setThemeClass(theme);
  window.setTimeout(() => root.classList.remove("theme-transitioning"), 360);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const isLight = theme === "light";

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = isLight ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme, true);
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      type="button"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={isLight}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      onClick={toggleTheme}
      className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background text-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Sun
        className={`absolute h-4 w-4 transition duration-300 ${
          isLight ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <Moon
        className={`absolute h-4 w-4 transition duration-300 ${
          isLight ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
        }`}
      />
    </button>
  );
}
