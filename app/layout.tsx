import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "instsig",
  description: "SI unit management system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
