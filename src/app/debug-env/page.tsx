// TEMPORARY debug page — delete once the login issue is diagnosed.
// Reveals no secrets: just enough to confirm Vercel's env vars point at the
// right Supabase project (the anon key's project ref is not sensitive — it's
// already embedded in every request the browser makes).
export default function DebugEnvPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unset)";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  let anonKeyRef = "(could not decode)";
  try {
    const payload = JSON.parse(
      Buffer.from(anonKey.split(".")[1], "base64").toString("utf8")
    );
    anonKeyRef = `ref=${payload.ref} role=${payload.role}`;
  } catch {
    // leave default
  }

  return (
    <pre>
      {`NEXT_PUBLIC_SUPABASE_URL: ${url}\nANON_KEY: ${anonKeyRef}\nHas service role key: ${Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )}`}
    </pre>
  );
}
