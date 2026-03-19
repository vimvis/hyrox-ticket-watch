export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasResendApiKey() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getSessionSecretStatus() {
  return process.env.SESSION_SECRET ? "configured" : "development-fallback";
}
