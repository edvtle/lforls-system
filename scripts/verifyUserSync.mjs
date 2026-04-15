import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const required = [
  "DATABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const email = `lforlsplp+synccheck${Date.now()}@gmail.com`;
const password = `Test-${crypto.randomUUID()}aA1!`;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Sync Check" } },
  });

  if (error) {
    throw error;
  }

  await client.connect();
  const row = await client.query(
    "select id, email, (password_hash is not null) as has_hash from public.users where email = $1 limit 1",
    [email],
  );

  if (!row.rowCount) {
    throw new Error(
      "No row found in public.users for the newly created account.",
    );
  }

  if (!row.rows[0].has_hash) {
    throw new Error("Row exists in public.users but password_hash is null.");
  }

  console.log("User sync check passed.");
  console.log("Created auth user id:", data.user?.id || "(unknown)");
  console.log("public.users row:", row.rows[0]);
} catch (error) {
  console.error("User sync check failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
