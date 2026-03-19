export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasResendApiKey() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getSessionSecretStatus() {
  return process.env.SESSION_SECRET ? "configured" : "development-fallback";
}

export function getHyroxMonitorTimeoutMs() {
  return Number(process.env.HYROX_MONITOR_TIMEOUT_MS ?? "15000");
}

export function getHyroxMonitorUrlOverride() {
  return process.env.HYROX_MONITOR_URL_OVERRIDE?.trim() || null;
}
