import crypto from "node:crypto";
import http from "node:http";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import pg from "pg";

dotenv.config();

const { Client } = pg;
const serverPort = Number(process.env.RESET_API_PORT || 4001);
const allowedOrigin = process.env.RESET_ALLOWED_ORIGIN || "*";

const fromConnectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!fromConnectionString) {
  console.error("Missing DATABASE_URL or SUPABASE_DB_URL in .env");
  process.exit(1);
}

const smtpRequired = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];
const smtpMissing = smtpRequired.filter((key) => !process.env[key]);
if (smtpMissing.length) {
  console.error(`Missing SMTP config in .env: ${smtpMissing.join(", ")}`);
  process.exit(1);
}

const smtpPort = Number(process.env.SMTP_PORT);
if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
  console.error("SMTP_PORT must be a valid positive number.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const db = new Client({
  connectionString: fromConnectionString,
  ssl: { rejectUnauthorized: false },
});

const nowIso = () => new Date().toISOString();
const toHash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const createCode = () => String(Math.floor(100000 + Math.random() * 900000));
const createToken = () => crypto.randomBytes(24).toString("hex");
const resetCodeTtlMinutes = Number(process.env.RESET_CODE_TTL_MINUTES || 10);
const resetSessionTtlMinutes = Number(
  process.env.RESET_SESSION_TTL_MINUTES || 15,
);

const json = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
};

const parseBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
};

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const ensureSchema = async () => {
  await db.query(`
    create table if not exists public.password_reset_codes (
      email text primary key,
      code_hash text not null,
      reset_token_hash text,
      expires_at timestamptz not null,
      attempts integer not null default 0,
      verified_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
};

const emailExists = async (email) => {
  const { rows } = await db.query(
    `
      select exists (
        select 1
        from auth.users
        where lower(email) = $1
      ) as exists
    `,
    [email],
  );

  return Boolean(rows[0]?.exists);
};

const upsertResetCode = async (email, codeHash) => {
  await db.query(
    `
      insert into public.password_reset_codes (
        email,
        code_hash,
        reset_token_hash,
        expires_at,
        attempts,
        verified_at,
        updated_at
      )
      values (
        $1,
        $2,
        null,
        now() + make_interval(mins => $3::int),
        0,
        null,
        now()
      )
      on conflict (email) do update
      set code_hash = excluded.code_hash,
          reset_token_hash = null,
          expires_at = excluded.expires_at,
          attempts = 0,
          verified_at = null,
          updated_at = now()
    `,
    [email, codeHash, resetCodeTtlMinutes],
  );
};

const sendResetEmail = async (email, code) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your password reset code",
    text: `Use this 6-digit password reset code: ${code}\n\nThis code expires in ${resetCodeTtlMinutes} minutes.`,
    html: `<p>Use this 6-digit password reset code:</p><h2 style=\"letter-spacing:2px\">${code}</h2><p>This code expires in ${resetCodeTtlMinutes} minutes.</p>`,
  });
};

const verifyCode = async (email, code) => {
  const codeHash = toHash(code);
  const { rows } = await db.query(
    `
      select email, code_hash, expires_at, attempts
      from public.password_reset_codes
      where email = $1
    `,
    [email],
  );

  const record = rows[0];
  if (!record) {
    return { ok: false, message: "Invalid or expired code." };
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { ok: false, message: "Code expired. Request a new one." };
  }

  if (Number(record.attempts) >= 5) {
    return { ok: false, message: "Too many attempts. Request a new code." };
  }

  if (record.code_hash !== codeHash) {
    await db.query(
      `
        update public.password_reset_codes
        set attempts = attempts + 1,
            updated_at = now()
        where email = $1
      `,
      [email],
    );
    return { ok: false, message: "Invalid code." };
  }

  const resetToken = createToken();
  await db.query(
    `
      update public.password_reset_codes
      set reset_token_hash = $2,
          expires_at = now() + make_interval(mins => $3::int),
          verified_at = now(),
          updated_at = now()
      where email = $1
    `,
    [email, toHash(resetToken), resetSessionTtlMinutes],
  );

  return { ok: true, resetToken };
};

const resetPassword = async (email, resetToken, newPassword) => {
  const { rows } = await db.query(
    `
      select reset_token_hash, expires_at, verified_at
      from public.password_reset_codes
      where email = $1
    `,
    [email],
  );

  const record = rows[0];
  if (!record || !record.verified_at) {
    return { ok: false, message: "Reset verification not found." };
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { ok: false, message: "Reset session expired. Request a new code." };
  }

  if (record.reset_token_hash !== toHash(resetToken)) {
    return { ok: false, message: "Invalid reset token." };
  }

  const result = await db.query(
    `
      update auth.users
      set encrypted_password = crypt($1, gen_salt('bf')),
          updated_at = now()
      where lower(email) = $2
    `,
    [newPassword, email],
  );

  if (!result.rowCount) {
    return { ok: false, message: "Account not found." };
  }

  await db.query(`delete from public.password_reset_codes where email = $1`, [
    email,
  ]);
  return { ok: true };
};

const handler = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await parseBody(req);

    if (req.url === "/api/password-reset/email-exists") {
      const email = normalizeEmail(body?.email);
      if (!email) {
        json(res, 400, { error: "Email is required." });
        return;
      }

      const exists = await emailExists(email);
      json(res, 200, { exists });
      return;
    }

    if (req.url === "/api/password-reset/request") {
      const email = normalizeEmail(body?.email);
      if (!email) {
        json(res, 400, { error: "Email is required." });
        return;
      }

      const exists = await emailExists(email);
      if (!exists) {
        json(res, 404, { error: "Email not found." });
        return;
      }

      const code = createCode();
      await upsertResetCode(email, toHash(code));
      await sendResetEmail(email, code);
      json(res, 200, { sent: true, at: nowIso() });
      return;
    }

    if (req.url === "/api/password-reset/verify") {
      const email = normalizeEmail(body?.email);
      const code = String(body?.code || "").trim();

      if (!email || !/^\d{6}$/.test(code)) {
        json(res, 400, { error: "Email and 6-digit code are required." });
        return;
      }

      const result = await verifyCode(email, code);
      if (!result.ok) {
        json(res, 400, { error: result.message });
        return;
      }

      json(res, 200, { verified: true, resetToken: result.resetToken });
      return;
    }

    if (req.url === "/api/password-reset/reset") {
      const email = normalizeEmail(body?.email);
      const resetToken = String(body?.resetToken || "").trim();
      const newPassword = String(body?.newPassword || "");

      if (!email || !resetToken || !newPassword) {
        json(res, 400, {
          error: "Email, reset token, and new password are required.",
        });
        return;
      }

      if (newPassword.length < 6) {
        json(res, 400, { error: "Password must be at least 6 characters." });
        return;
      }

      const result = await resetPassword(email, resetToken, newPassword);
      if (!result.ok) {
        json(res, 400, { error: result.message });
        return;
      }

      json(res, 200, { success: true });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, 500, { error: error?.message || "Unexpected server error" });
  }
};

await db.connect();
await ensureSchema();
await transporter.verify();

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    json(res, 500, { error: error?.message || "Unexpected server error" });
  });
});

server.listen(serverPort, () => {
  console.log(`Reset API listening on http://localhost:${serverPort}`);
});
