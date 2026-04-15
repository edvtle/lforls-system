import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const usersCount = await client.query(
    "select count(*)::int as count from public.users",
  );
  const authCount = await client.query(
    "select count(*)::int as count from auth.users",
  );
  const sample = await client.query(
    "select id, email, (password_hash is not null) as has_hash from public.users order by created_at desc limit 3",
  );
  const schemaMigrationExists = await client.query(
    "select to_regclass('public.schema_migrations') as tbl",
  );
  const healthExists = await client.query(
    "select to_regclass('public.connection_healthcheck') as tbl",
  );

  console.log("public.users count:", usersCount.rows[0].count);
  console.log("auth.users count:", authCount.rows[0].count);
  console.log("sample public.users rows:", sample.rows);
  console.log("schema_migrations exists:", schemaMigrationExists.rows[0].tbl);
  console.log("connection_healthcheck exists:", healthExists.rows[0].tbl);
} catch (error) {
  console.error("DB inspect failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
