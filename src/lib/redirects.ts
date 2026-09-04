import { env } from "cloudflare:workers";

export interface RedirectRule {
  sourcePath: string;
  destinationPath?: string;
  statusCode: 301 | 308 | 410;
  note?: string;
}

interface RedirectRow {
  source_path: string;
  destination_path: string | null;
  status_code: number;
  note: string | null;
}

function normalizeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  try {
    const url = new URL(value, "https://agentfirst.directory");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export async function getRedirectRule(pathname: string): Promise<RedirectRule | null> {
  if (!env.DB) {
    return null;
  }

  const sourcePath = normalizeInternalPath(pathname);

  if (!sourcePath) {
    return null;
  }

  const row = await env.DB
    .prepare(
      `
        SELECT source_path, destination_path, status_code, note
        FROM url_redirects
        WHERE source_path = ?1
          AND is_active = 1
      `,
    )
    .bind(sourcePath)
    .first<RedirectRow>();

  if (!row || ![301, 308, 410].includes(row.status_code)) {
    return null;
  }

  const destinationPath = row.destination_path
    ? normalizeInternalPath(row.destination_path)
    : undefined;

  if (row.status_code !== 410 && (!destinationPath || destinationPath === sourcePath)) {
    return null;
  }

  return {
    sourcePath,
    destinationPath,
    statusCode: row.status_code as RedirectRule["statusCode"],
    note: row.note ?? undefined,
  };
}
