import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everwell — your wellness, in rhythm",
  description: "A calm space to track strength, nutrition and the small steps that add up.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#f6f8f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
