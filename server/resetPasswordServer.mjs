import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import pg from "pg";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

const fetchNotificationProfileByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      select
        u.id,
        coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1), 'Unnamed user') as full_name,
        coalesce(p.email, u.email, '') as email,
        coalesce(p.notification_email_updates, false) as notification_email_updates
      from auth.users u
      left join public.profiles p on p.id = u.id
      where u.id = $1
      limit 1
    `,
    [userId],
  );

  return rows[0] || null;
};

const emailTheme = {
  background: "#0f0f0f",
  surface: "#202020",
  surfaceAlt: "#141414",
  panel: "#191f16",
  text: "#f5f7f2",
  muted: "#b8c4b3",
  accent: "#5dd62c",
  accentSoft: "#dff3d8",
  danger: "#ff6b57",
  warning: "#ffc857",
  border: "rgba(93, 214, 44, 0.22)",
};

const brandLogoPath = path.resolve(__dirname, "../public/logo.png");
const brandLogoCid = "lforls-logo";
const hasBrandLogo = fs.existsSync(brandLogoPath);

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatEmailBody = (value = "") =>
  escapeHtml(value).replace(/\n/g, "<br />");

const buildEmailTemplate = ({
  eyebrow = "Lost and Found System",
  title,
  summary,
  bodyLines = [],
  badge = "",
  statusLabel = "",
  statusTone = "accent",
  footer = "If you need help, contact the support team.",
  preheader = "",
}) => {
  const statusColor =
    statusTone === "danger"
      ? emailTheme.danger
      : statusTone === "warning"
        ? emailTheme.warning
        : emailTheme.accent;
  const bodyMarkup = bodyLines
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;color:${emailTheme.text};line-height:1.65;font-size:15px;">${formatEmailBody(
          line,
        )}</p>`,
    )
    .join("");

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader || summary || title)}
    </div>
    <div style="margin:0;padding:0;background:${emailTheme.background};font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="border:1px solid ${emailTheme.border};border-radius:28px;overflow:hidden;background:${emailTheme.surface};box-shadow:0 24px 80px rgba(0,0,0,0.42);">
          <div style="padding:28px 30px 22px;background:radial-gradient(circle at top left, rgba(93,214,44,0.28), rgba(93,214,44,0) 42%), linear-gradient(145deg, rgba(93,214,44,0.14), rgba(32,32,32,0.98));border-bottom:1px solid ${emailTheme.border};">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:14px;">
                ${
                  hasBrandLogo
                    ? `<div style="width:52px;height:52px;border-radius:16px;background:rgba(93,214,44,0.14);border:1px solid rgba(93,214,44,0.24);display:flex;align-items:center;justify-content:center;">
                <img src="cid:${brandLogoCid}" alt="LFORLS" width="36" height="36" style="display:block;" />
              </div>`
                    : `<div style="width:52px;height:52px;border-radius:16px;background:rgba(93,214,44,0.14);border:1px solid rgba(93,214,44,0.24);color:${emailTheme.accent};font-size:14px;font-weight:800;letter-spacing:0.08em;display:flex;align-items:center;justify-content:center;">LF</div>`
                }
                <div>
                  <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(93,214,44,0.14);color:${emailTheme.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                    ${escapeHtml(eyebrow)}
                  </div>
                  <div style="margin-top:9px;color:${emailTheme.muted};font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">
                    LFORLS Updates
                  </div>
                </div>
              </div>
              ${
                statusLabel
                  ? `<div style="display:inline-block;padding:8px 14px;border-radius:999px;background:${statusColor};color:#071206;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
                ${escapeHtml(statusLabel)}
              </div>`
                  : ""
              }
            </div>
            <h1 style="margin:24px 0 10px;color:${emailTheme.text};font-size:30px;line-height:1.18;font-weight:800;letter-spacing:-0.03em;">${escapeHtml(
              title,
            )}</h1>
            <p style="margin:0;color:${emailTheme.muted};font-size:15px;line-height:1.7;max-width:540px;">${escapeHtml(
              summary,
            )}</p>
          </div>
          <div style="padding:26px 30px 30px;background:${emailTheme.surfaceAlt};">
            ${badge ? `<div style="margin:0 0 18px;display:inline-block;padding:8px 14px;border-radius:999px;background:${emailTheme.accent};color:#071206;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(badge)}</div>` : ""}
            ${bodyMarkup}
            <div style="margin-top:22px;padding:16px 18px;border-radius:20px;border:1px solid ${emailTheme.border};background:${emailTheme.panel};color:${emailTheme.muted};font-size:13px;line-height:1.6;">
              ${escapeHtml(footer)}
            </div>
          </div>
          <div style="padding:14px 30px 20px;border-top:1px solid ${emailTheme.border};background:${emailTheme.background};color:${emailTheme.muted};font-size:12px;line-height:1.6;text-align:center;">
            <span style="display:inline-block;width:10px;height:10px;margin-right:8px;border-radius:999px;background:${emailTheme.accent};vertical-align:middle;"></span>
            PLP Lost and Found System
          </div>
        </div>
      </div>
    </div>
  `;
};

const buildMailOptions = ({ to, subject, text, html }) => ({
  from: process.env.SMTP_FROM,
  to,
  subject,
  text,
  html,
  attachments: hasBrandLogo
    ? [
        {
          filename: "logo.png",
          path: brandLogoPath,
          cid: brandLogoCid,
        },
      ]
    : [],
});

const sendNotificationEmail = async ({ recipientId, subject, text, html }) => {
  if (!recipientId) {
    return { ok: false, sent: false, message: "Recipient is required." };
  }

  const recipient = await fetchNotificationProfileByUserId(recipientId);
  if (!recipient?.email) {
    return { ok: false, sent: false, message: "Recipient email not found." };
  }

  if (!recipient.notification_email_updates) {
    return { ok: true, sent: false, skipped: true };
  }

  await transporter.sendMail(
    buildMailOptions({
      to: recipient.email,
      subject,
      text,
      html,
    }),
  );

  return { ok: true, sent: true };
};

const sendAccountStatusNotification = async ({ userId, status, suspensionEndsAt }) => {
  const normalizedStatus = String(status || "").toLowerCase();
  const profile = await fetchNotificationProfileByUserId(userId);

  if (!profile?.email) {
    return { ok: false, sent: false, message: "Recipient email not found." };
  }

  const statusLabel = normalizedStatus === "banned" ? "banned" : "suspended";
  const subject =
    statusLabel === "banned"
      ? "Your account has been banned"
      : "Your account has been suspended";
  const text =
    statusLabel === "banned"
      ? `Hello ${profile.full_name},\n\nYour Lost and Found account has been banned by an administrator.\n\nIf you believe this is a mistake, please contact the support team.`
      : `Hello ${profile.full_name},\n\nYour Lost and Found account has been suspended by an administrator.${
          suspensionEndsAt ? `\nSuspension ends at: ${suspensionEndsAt}` : ""
        }\n\nIf you believe this is a mistake, please contact the support team.`;
  const html = buildEmailTemplate({
    title: statusLabel === "banned" ? "Account banned" : "Account suspended",
    summary:
      statusLabel === "banned"
        ? "Access to your account has been blocked by an administrator."
        : "Access to your account has been temporarily restricted by an administrator.",
    badge: statusLabel === "banned" ? "Banned" : "Suspended",
    statusLabel: statusLabel === "banned" ? "Access blocked" : "Temporary hold",
    statusTone: statusLabel === "banned" ? "danger" : "warning",
    preheader:
      statusLabel === "banned"
        ? "Your Lost and Found account has been banned by an administrator."
        : "Your Lost and Found account has been suspended by an administrator.",
    bodyLines:
      statusLabel === "banned"
        ? [
            `Hello ${profile.full_name},`,
            "Your Lost and Found account has been banned by an administrator.",
            "If you believe this is a mistake, please contact the support team.",
          ]
        : [
            `Hello ${profile.full_name},`,
            "Your Lost and Found account has been suspended by an administrator.",
            suspensionEndsAt ? `Suspension ends at: ${suspensionEndsAt}` : "",
            "If you believe this is a mistake, please contact the support team.",
          ],
  });

  return sendNotificationEmail({
    recipientId: userId,
    subject,
    text,
    html,
  });
};

const sendReportNotification = async ({
  itemId,
  conversationId,
  reporterUserId,
  reportedUserId,
  reason,
  message,
}) => {
  const normalizedReason = String(reason || "reported issue").trim() || "reported issue";
  const normalizedMessage = String(message || "").trim();

  let recipientId = "";
  let subject = "Your account was reported";
  let text = `Hello,\n\nA report was submitted for your account.\nReason: ${normalizedReason}`;
  let html = buildEmailTemplate({
    title: "Account report received",
    summary: "A report has been submitted and is now under review.",
    badge: "Reported",
    bodyLines: [
      "Hello,",
      "A report was submitted for your account.",
      `Reason: ${normalizedReason}`,
    ],
  });

  if (conversationId) {
    recipientId = String(reportedUserId || "").trim();

    if (!recipientId) {
      const { rows } = await db.query(
        `
          select user_id
          from public.message_participants
          where conversation_id = $1
            and ($2::uuid is null or user_id <> $2)
          order by last_read_at desc nulls last, user_id asc
          limit 1
        `,
        [conversationId, reporterUserId || null],
      );

      recipientId = rows[0]?.user_id || "";
    }

    subject = "Your conversation was reported";
    text = `Hello,\n\nA conversation involving your account was reported.\nReason: ${normalizedReason}${
      normalizedMessage ? `\nDetails: ${normalizedMessage}` : ""
    }`;
    html = buildEmailTemplate({
      title: "Chat reported",
      summary: "A conversation involving your account was reported and sent for review.",
      badge: "Conversation",
      bodyLines: [
        "Hello,",
        "A conversation involving your account was reported.",
        `Reason: ${normalizedReason}`,
        normalizedMessage ? `Details: ${normalizedMessage}` : "",
      ],
    });
  } else if (itemId) {
    const { rows } = await db.query(
      `
        select reporter_id, item_name
        from public.items
        where id = $1
        limit 1
      `,
      [itemId],
    );

    recipientId = rows[0]?.reporter_id || "";
    const itemName = rows[0]?.item_name || "your item";
    subject = "Your item was reported";
    text = `Hello,\n\n${itemName} was reported by another user.\nReason: ${normalizedReason}${
      normalizedMessage ? `\nDetails: ${normalizedMessage}` : ""
    }`;
    html = buildEmailTemplate({
      title: "Item reported",
      summary: "One of your posted items has been reported for review.",
      badge: "Item report",
      bodyLines: [
        "Hello,",
        `${itemName} was reported by another user.`,
        `Reason: ${normalizedReason}`,
        normalizedMessage ? `Details: ${normalizedMessage}` : "",
      ],
    });
  }

  if (!recipientId) {
    return { ok: false, sent: false, message: "No report recipient found." };
  }

  return sendNotificationEmail({
    recipientId,
    subject,
    text,
    html,
  });
};

const sendClaimDecisionNotification = async ({ claimId, status }) => {
  const normalizedStatus = String(status || "").toLowerCase();
  if (!claimId || !normalizedStatus) {
    return { ok: false, sent: false, message: "Claim id and status are required." };
  }

  const { rows } = await db.query(
    `
      select
        c.id,
        c.claimant_id,
        c.item_id,
        coalesce(i.item_name, 'your request') as item_name
      from public.claims c
      left join public.items i on i.id = c.item_id
      where c.id::text = $1
      limit 1
    `,
    [claimId],
  );

  const claim = rows[0];
  if (!claim) {
    return { ok: false, sent: false, message: "Claim not found." };
  }

  let recipientId = String(claim.claimant_id || "").trim();
  let recipientEmail = "";
  let recipientName = "";

  if (recipientId) {
    const profile = await fetchNotificationProfileByUserId(recipientId);
    recipientEmail = profile?.email || "";
    recipientName = profile?.full_name || "";

    if (!recipientEmail || !profile?.notification_email_updates) {
      return { ok: true, sent: false, skipped: true };
    }
  } else {
    const contactValue = String(claim.contact_value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
      return { ok: true, sent: false, skipped: true };
    }
    recipientEmail = contactValue;
    recipientName = "there";
  }

  const isApproved = normalizedStatus === "approved" || normalizedStatus === "accepted";
  const subject = isApproved ? "Your claim was approved" : "Your claim was rejected";
  const itemName = String(claim.item_name || "your request").trim() || "your request";
  const text = isApproved
    ? `Hello ${recipientName || "there"},\n\nYour claim for ${itemName} has been approved by an administrator.`
    : `Hello ${recipientName || "there"},\n\nYour claim for ${itemName} has been rejected by an administrator.`;
  const html = buildEmailTemplate({
    title: isApproved ? "Claim approved" : "Claim rejected",
    summary: isApproved
      ? "Your ownership request was approved by an administrator."
      : "Your ownership request was reviewed and rejected by an administrator.",
    badge: isApproved ? "Approved" : "Rejected",
    bodyLines: [
      `Hello ${recipientName || "there"},`,
      `Your claim for ${itemName} has been ${isApproved ? "approved" : "rejected"} by an administrator.`,
    ],
  });

  await transporter.sendMail(
    buildMailOptions({
      to: recipientEmail,
      subject,
      text,
      html,
    }),
  );

  return { ok: true, sent: true };
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
  await transporter.sendMail(
    buildMailOptions({
      to: email,
      subject: "Your password reset code",
      text: `Use this 6-digit password reset code: ${code}\n\nThis code expires in ${resetCodeTtlMinutes} minutes.`,
      html: buildEmailTemplate({
        title: "Password reset code",
        summary: "Use the verification code below to continue resetting your password.",
        badge: "Security",
        statusLabel: "6-digit code",
        preheader: `Your password reset code is ${code}.`,
        bodyLines: [
          "Use this 6-digit password reset code:",
          code,
          `This code expires in ${resetCodeTtlMinutes} minutes.`,
        ],
        footer:
          "If you did not request a password reset, you can safely ignore this email.",
      }),
    }),
  );
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

const deleteUserAccount = async (userId) => {
  if (!userId) {
    return { ok: false, message: "User ID is required." };
  }
  try {
    await db.query("begin");

    // Delete auth row first; profile row is removed by trigger.
    const authDeleteResult = await db.query(
      `delete from auth.users where id = $1`,
      [userId],
    );

    await db.query("commit");

    if (!authDeleteResult.rowCount) {
      return { ok: false, message: "User account not found in auth.users." };
    }

    return { ok: true };
  } catch (error) {
    await db.query("rollback");
    return { ok: false, message: error?.message || "Unable to delete user." };
  }
};

const listAdminUsers = async () => {
  const { rows } = await db.query(`
    select
      u.id,
      coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1), 'Unnamed user') as full_name,
      coalesce(p.email, u.email, '') as email,
      coalesce(nullif(p.college_dept, ''), 'N/A') as college_dept,
      coalesce(nullif(p.year_section, ''), 'N/A') as year_section,
      coalesce(nullif(p.status, ''), 'active') as status,
      p.suspended_until,
      coalesce(i.items_count, 0) as reports_count
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join (
      select reporter_id, count(*)::int as items_count
      from public.items
      group by reporter_id
    ) i on i.reporter_id = u.id
    order by lower(coalesce(nullif(p.full_name, ''), nullif(u.email, ''), 'zzz')) asc
    limit 500
  `);

  return rows;
};

const purgeOrphanAuthUserByEmail = async (email) => {
  if (!email) {
    return { ok: false, message: "Email is required." };
  }

  try {
    const { rows: authRows } = await db.query(
      `
        select id
        from auth.users
        where lower(email) = $1
        limit 1
      `,
      [email],
    );

    const authUserId = authRows[0]?.id;
    if (!authUserId) {
      return { ok: true, purged: false };
    }

    const { rows: profileRows } = await db.query(
      `
        select id
        from public.profiles
        where id = $1
        limit 1
      `,
      [authUserId],
    );

    if (profileRows.length > 0) {
      return {
        ok: false,
        message: "User already exists in auth and profile records.",
      };
    }

    await db.query("begin");
    await db.query(`delete from public.password_reset_codes where email = $1`, [
      email,
    ]);
    await db.query(`delete from auth.users where id = $1`, [authUserId]);
    await db.query("commit");

    return { ok: true, purged: true };
  } catch (error) {
    await db.query("rollback");
    return {
      ok: false,
      message: error?.message || "Unable to purge orphan auth user.",
    };
  }
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

    if (req.url === "/api/admin/delete-user") {
      const userId = String(body?.userId || "").trim();
      if (!userId) {
        json(res, 400, { error: "userId is required." });
        return;
      }

      const result = await deleteUserAccount(userId);
      if (!result.ok) {
        json(res, 400, { error: result.message });
        return;
      }

      json(res, 200, { success: true });
      return;
    }

    if (req.url === "/api/admin/send-notification-email") {
      const kind = String(body?.kind || "").trim().toLowerCase();

      if (kind === "status") {
        const userId = String(body?.userId || "").trim();
        const status = String(body?.status || "").trim().toLowerCase();
        const suspensionEndsAt = String(body?.suspensionEndsAt || "").trim();

        if (!userId || !status) {
          json(res, 400, { error: "userId and status are required." });
          return;
        }

        const result = await sendAccountStatusNotification({
          userId,
          status,
          suspensionEndsAt,
        });

        if (!result.ok) {
          json(res, 400, { error: result.message || "Unable to send status email." });
          return;
        }

        json(res, 200, { success: true, sent: Boolean(result.sent), skipped: Boolean(result.skipped) });
        return;
      }

      if (kind === "report") {
        const itemId = String(body?.itemId || "").trim();
        const conversationId = String(body?.conversationId || "").trim();
        const reporterUserId = String(body?.reporterUserId || "").trim();
        const reportedUserId = String(body?.reportedUserId || "").trim();
        const reason = String(body?.reason || "").trim();
        const message = String(body?.message || "").trim();

        if (!itemId && !conversationId) {
          json(res, 400, { error: "itemId or conversationId is required." });
          return;
        }

        const result = await sendReportNotification({
          itemId: itemId || null,
          conversationId: conversationId || null,
          reporterUserId: reporterUserId || null,
          reportedUserId: reportedUserId || null,
          reason,
          message,
        });

        if (!result.ok) {
          json(res, 400, { error: result.message || "Unable to send report email." });
          return;
        }

        json(res, 200, { success: true, sent: Boolean(result.sent), skipped: Boolean(result.skipped) });
        return;
      }

      if (kind === "claim") {
        const claimId = String(body?.claimId || "").trim();
        const status = String(body?.status || "").trim();

        if (!claimId || !status) {
          json(res, 400, { error: "claimId and status are required." });
          return;
        }

        const result = await sendClaimDecisionNotification({ claimId, status });

        if (!result.ok) {
          json(res, 400, { error: result.message || "Unable to send claim email." });
          return;
        }

        json(res, 200, { success: true, sent: Boolean(result.sent), skipped: Boolean(result.skipped) });
        return;
      }

      json(res, 400, { error: "Unsupported notification kind." });
      return;
    }

    if (req.url === "/api/admin/purge-orphan-auth-user") {
      const email = normalizeEmail(body?.email);
      if (!email) {
        json(res, 400, { error: "Email is required." });
        return;
      }

      const result = await purgeOrphanAuthUserByEmail(email);
      if (!result.ok) {
        json(res, 409, { error: result.message });
        return;
      }

      json(res, 200, { success: true, purged: Boolean(result.purged) });
      return;
    }

    if (req.url === "/api/admin/list-users") {
      const users = await listAdminUsers();
      json(res, 200, { users });
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
