// Deliberately minimal — this app's data is live/Supabase-backed, so we do
// NOT want to cache pages or API responses (that risks showing an employee
// stale totals or a stale form). This worker exists only to satisfy Chrome's
// installability criteria (a registered service worker with a fetch
// handler), which is what turns "Add to Home Screen" into a real "Install
// app" with its own standalone window instead of a plain bookmark shortcut.
// Every request just passes straight through to the network, unmodified.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
