function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function readServerAuthorityFlag(): boolean {
  const query = new URLSearchParams(window.location.search);
  const authorityMode = query.get("authority")?.trim().toLowerCase();
  if (authorityMode === "local") return false;
  if (authorityMode === "server") return true;

  const queryFlag = parseBoolean(query.get("server_authoritative_only") ?? undefined);
  if (queryFlag !== null) return queryFlag;

  const envFlag = parseBoolean(import.meta.env.VITE_SERVER_AUTHORITATIVE_ONLY);
  if (envFlag !== null) return envFlag;

  return true;
}

export const SERVER_AUTHORITATIVE_ONLY = readServerAuthorityFlag();
