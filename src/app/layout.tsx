import type { Metadata, Viewport } from "next";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

export const metadata: Metadata = { title: "Groceries", description: "Shared groceries for Michael, Kevin, Feo, and Saketh." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<MobileNav /></body></html>;
}
