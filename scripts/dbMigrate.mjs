import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const migrationsDir = path.resolve(rootDir, "supabase", "migrations");
const INITIAL_SCHEMA_MIGRATION = "20260415_000001_initial_schema.sql";
const MIGRATION_SCHEMA = "app_internal";
const MIGRATION_TABLE = `${MIGRATION_SCHEMA}.schema_migrations`;

const fromConnectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const fromParts =
  process.env.SUPABASE_DB_HOST &&
  process.env.SUPABASE_DB_PORT &&
  process.env.SUPABASE_DB_NAME &&
  process.env.SUPABASE_DB_USER &&
  process.env.SUPABASE_DB_PASSWORD
    ? {
        host: process.env.SUPABASE_DB_HOST,
        port: Number(process.env.SUPABASE_DB_PORT),
        database: process.env.SUPABASE_DB_NAME,
        user: process.env.SUPABASE_DB_USER,
        password: process.env.SUPABASE_DB_PASSWORD,
      }
    : null;

if (!fromConnectionString && !fromParts) {
  console.error(
    "Missing DB config. Set DATABASE_URL (or SUPABASE_DB_URL), or set SUPABASE_DB_HOST/SUPABASE_DB_PORT/SUPABASE_DB_NAME/SUPABASE_DB_USER/SUPABASE_DB_PASSWORD in .env.",
  );
  process.exit(1);
}

const run = async () => {
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((entry) => entry.toLowerCase().endsWith(".sql"))
    .sort();

  if (!migrationFiles.length) {
    console.log("No migration files found.");
    return;
  }

  const client = new Client({
    ...(fromConnectionString
      ? { connectionString: fromConnectionString }
      : fromParts),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    await client.query(`create schema if not exists ${MIGRATION_SCHEMA}`);

    await client.query(`
      create table if not exists ${MIGRATION_TABLE} (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = await client.query(`select id from ${MIGRATION_TABLE}`);
    const appliedSet = new Set(applied.rows.map((row) => row.id));

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        continue;
      }

      const sql = await fs.readFile(path.resolve(migrationsDir, file), "utf8");

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(`insert into ${MIGRATION_TABLE} (id) values ($1)`, [
          file,
        ]);
        await client.query("commit");
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query("rollback");

        if (
          file === INITIAL_SCHEMA_MIGRATION &&
          /already exists/i.test(error.message) &&
          (await hasAllInitialSchemaTables(client))
        ) {
          await client.query(
            `insert into ${MIGRATION_TABLE} (id) values ($1)`,
            [file],
          );
          console.log(
            `Marked migration as already applied: ${file} (schema objects already exist).`,
          );
          continue;
        }

        throw error;
      }
    }

    console.log("All pending migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);

    if (error.message.includes("password authentication failed")) {
      console.error(
        "Authentication failed. Verify DB credentials in .env. You may need to reset the database password in Supabase Project Settings -> Database.",
      );
    }

    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();

async function hasAllInitialSchemaTables(client) {
  const requiredTables = [
    "profiles",
    "items",
    "item_images",
    "matches",
    "claims",
    "conversations",
    "messages",
    "notifications",
    "flags",
    "audit_logs",
  ];

  const result = await client.query(
    `
      select count(*)::int as table_count
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [requiredTables],
  );

  return result.rows[0]?.table_count === requiredTables.length;
}
