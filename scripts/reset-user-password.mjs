// Emergency password reset for any account (owner or employee), for when
// someone is locked out and can't use the in-app "Reset password" button
// (which requires already being logged in as owner).
//
// Usage: node scripts/reset-user-password.mjs someone@example.com

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/reset-user-password.mjs someone@example.com");
  process.exit(1);
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// listUsers doesn't support filtering by email directly in older SDK versions,
// so page through (fine at this account's scale).
let user = null;
for (let page = 1; page <= 10 && !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Error listing users:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}

if (!user) {
  console.error(`No account found for ${email}`);
  process.exit(1);
}

const tempPassword = generateTempPassword();
const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: tempPassword,
});

if (updateError) {
  console.error("Error resetting password:", updateError.message);
  process.exit(1);
}

console.log(`Password reset for ${email}:`);
console.log(tempPassword);
