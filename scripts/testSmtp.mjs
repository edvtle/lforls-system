import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const required = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_TO",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(
    `Missing SMTP config in .env: ${missing.join(", ")}. Add them before running this check.`,
  );
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

try {
  await transporter.verify();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.SMTP_TO,
    subject: "SMTP test - PLP Lost and Found",
    text: "This is a test email from the Node.js SMTP checker.",
  });

  console.log("SMTP is working. Test email sent.");
  console.log(`Message ID: ${info.messageId}`);
} catch (error) {
  console.error("SMTP test failed:", error.message);
  process.exitCode = 1;
}
