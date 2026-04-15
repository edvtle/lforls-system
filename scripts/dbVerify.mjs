import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const { Client } = pg;

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

const verifyPostgresStoreAndFetch = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const marker = `health-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  try {
    await client.connect();

    await client.query(`
      create temporary table if not exists connection_healthcheck (
        id bigserial primary key,
        marker text not null unique,
        created_at timestamptz not null default now()
      ) on commit drop
    `);

    await client.query(
      "insert into connection_healthcheck (marker) values ($1)",
      [marker],
    );

    const fetched = await client.query(
      "select marker from connection_healthcheck where marker = $1",
      [marker],
    );

    if (!fetched.rowCount) {
      throw new Error("Inserted row was not fetched back.");
    }

    await client.query("delete from connection_healthcheck where marker = $1", [
      marker,
    ]);

    console.log("Postgres write/read check passed.");
  } finally {
    await client.end();
  }
};

const verifySupabaseAnonRead = async () => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data, error } = await supabase
    .from("items")
    .select("id, status")
    .in("status", ["open", "matched", "claimed", "resolved"])
    .limit(1);

  if (error) {
    throw error;
  }

  console.log(
    `Supabase anon read check passed. Rows returned: ${data?.length || 0}.`,
  );
};

try {
  await verifyPostgresStoreAndFetch();
  await verifySupabaseAnonRead();
  console.log("Database verification completed successfully.");
} catch (error) {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
}
