import type { MetadataRoute } from "next";

// Next.js auto-serves this at /manifest.webmanifest and links it in <head> —
// this is what makes "Add to Home Screen" / "Install app" actually turn the
// site into a standalone app icon on a phone instead of just a bookmark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cypress Laundry — Coin Collection Tracker",
    short_name: "Cypress Coins",
    description: "Coin collection, bank deposit, and reporting tracker for Cypress Laundry.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#015887",
    icons: [
      { src: "/brand/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/brand/pwa-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
