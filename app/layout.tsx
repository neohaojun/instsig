import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "instsig",
  description: "speed through skill!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = window.localStorage.getItem("instsig-theme") === "light" ? "light" : "dark";
                  document.documentElement.classList.toggle("light", theme === "light");
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  document.documentElement.style.colorScheme = theme;
                  document.documentElement.style.backgroundColor = theme === "light" ? "#ffffff" : "#0a0a0a";
                  var themeColor = document.createElement("meta");
                  themeColor.name = "theme-color";
                  themeColor.content = theme === "light" ? "#ffffff" : "#0a0a0a";
                  document.head.appendChild(themeColor);
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
