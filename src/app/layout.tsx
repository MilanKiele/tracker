import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Everwell — Dein Alltag. Dein Rhythmus.",
  description:
    "Training, Ernährung und Fortschritt. Mit KI in deinem Rhythmus.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Everwell" },
  icons: { apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  themeColor: "#163b2b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
