import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cypress Laundry — Coin Collection Tracker",
  description: "Coin collection, bank deposit, and reporting tracker for Cypress Laundry.",
  // Makes "Add to Home Screen" on iOS Safari open as a standalone app (its
  // own title bar, no browser chrome) instead of just a bookmark — Android
  // gets the same behavior from manifest.ts's `display: "standalone"`.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cypress Coins",
  },
};

export const viewport: Viewport = {
  themeColor: "#015887",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
