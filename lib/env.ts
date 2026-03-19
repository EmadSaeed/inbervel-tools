// Validated environment variable exports.
//
// This module runs at server startup and throws a clear error if any required
// env var is missing, rather than silently failing later at call-site.
// Import from here instead of process.env directly for type-safe access.

const required = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "COGNITO_WEBHOOK_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
      "Check your .env.local (dev) or Vercel environment settings (prod).",
  );
}

// Type-cast is safe because we checked for presence above.
type RequiredEnv = { [K in (typeof required)[number]]: string };

export const env = process.env as unknown as RequiredEnv & {
  EMAIL_SERVER_PORT?: string;
  AUTH_EMAIL_FROM?: string;
  EMAIL_FROM?: string;
};
