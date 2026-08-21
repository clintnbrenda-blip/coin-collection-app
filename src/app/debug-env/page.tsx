// TEMPORARY debug page — delete once the login issue is diagnosed.
// Reveals no secrets: just enough to confirm Vercel's env vars point at the
// right Supabase project (the anon key's project ref is not sensitive — it's
// already embedded in every request the browser makes).
function inspectKey(key: string) {
  const trimmed = key.trim();
  const hasWhitespace = /\s/.test(key);
  const hasLeadingTrailingWhitespace = key !== trimmed;
  const parts = trimmed.split(".");

  let decodedPayload = "(could not decode)";
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    decodedPayload = `ref=${payload.ref} role=${payload.role} exp=${payload.exp}`;
  } catch (e) {
    decodedPayload = `decode failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    length: key.length,
    trimmedLength: trimmed.length,
    hasWhitespace,
    hasLeadingTrailingWhitespace,
    numDotParts: parts.length,
    preview: `${key.slice(0, 15)}...${key.slice(-10)}`,
    decodedPayload,
  };
}

export default function DebugEnvPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unset)";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return (
    <pre>
      {JSON.stringify(
        {
          url,
          anonKey: inspectKey(anonKey),
          serviceKey: serviceKey ? inspectKey(serviceKey) : "(unset)",
        },
        null,
        2
      )}
    </pre>
  );
}
