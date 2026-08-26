"use client";

import { useEffect } from "react";

// Registering a service worker (even one that does nothing but pass requests
// through, see public/sw.js) is one of Chrome's requirements for offering a
// real "Install app" prompt on Android instead of a plain bookmark shortcut.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not critical — fail silently.
      });
    }
  }, []);

  return null;
}
