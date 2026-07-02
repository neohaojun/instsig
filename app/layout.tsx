import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "instsig",
  description: "speed through skill!",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#09090b" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = window.localStorage.getItem("instsig-theme") === "light" ? "light" : "dark";
                  document.documentElement.classList.toggle("light", theme === "light");
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  document.documentElement.style.colorScheme = theme;
                  var themeColor = document.querySelector('meta[name="theme-color"]');
                  if (themeColor) themeColor.setAttribute("content", theme === "light" ? "#ffffff" : "#0a0a0a");
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
