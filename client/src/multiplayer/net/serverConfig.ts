declare global {
  interface Window {
    __RUNESHOT_SERVER_URL__?: string;
  }
}

const SERVER_STORAGE_KEY = "runeshot.serverUrl";

function normalizeServerUrl(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  return `${protocol}${trimmed}`;
}

function readQueryServerUrl(): string | null {
  const qs = new URLSearchParams(window.location.search);
  return normalizeServerUrl(qs.get("server") ?? qs.get("ws"));
}

function readStoredServerUrl(): string | null {
  try {
    return normalizeServerUrl(window.localStorage.getItem(SERVER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistServerUrl(serverUrl: string): void {
  try {
    window.localStorage.setItem(SERVER_STORAGE_KEY, serverUrl);
  } catch {
    // Ignore localStorage failures in restricted browser contexts.
  }
}

export function getServerUrl(): string {
  const fromQuery = readQueryServerUrl();
  if (fromQuery) {
    persistServerUrl(fromQuery);
    return fromQuery;
  }

  const fromRuntimeConfig = normalizeServerUrl(window.__RUNESHOT_SERVER_URL__);
  if (fromRuntimeConfig) return fromRuntimeConfig;

  const fromStored = readStoredServerUrl();
  if (fromStored) return fromStored;

  const fromBuild = normalizeServerUrl(import.meta.env.VITE_SERVER_URL as string | undefined);
  if (fromBuild) return fromBuild;

  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  return `${protocol}${window.location.hostname}:2567`;
}
