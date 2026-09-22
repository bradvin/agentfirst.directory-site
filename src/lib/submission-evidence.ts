export const ALLOWED_EVIDENCE_SOURCE_TYPES = [
  "official-documentation",
  "official-repository",
  "official-license",
  "official-pricing",
  "official-product-page",
  "official-product-announcement",
  "official-specification",
  "official-legal",
  "official-release-notes",
] as const;

export type EvidenceSourceType = (typeof ALLOWED_EVIDENCE_SOURCE_TYPES)[number];

export interface SubmissionEvidenceSource {
  title: string;
  url: string;
  claim: string;
  accessedAt: string;
  sourceType: EvidenceSourceType;
}

export interface SubmissionEvidenceInput extends SubmissionEvidenceSource {
  firstParty: boolean;
}

export interface SubmissionEvidenceError {
  path: string;
  message: string;
}

export type SubmissionEvidenceResult =
  | { ok: true; evidenceSources: SubmissionEvidenceSource[] }
  | { ok: false; errors: SubmissionEvidenceError[] };

export const MAX_EVIDENCE_SOURCES = 10;
export const MAX_SUBMISSION_EVIDENCE_REQUEST_BYTES = 64 * 1024;

const FIELD_LIMITS = {
  title: 200,
  url: 2048,
  claim: 1200,
} as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set<string>(ALLOWED_EVIDENCE_SOURCE_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(
  source: Record<string, unknown>,
  field: keyof typeof FIELD_LIMITS,
  path: string,
  label: string,
  errors: SubmissionEvidenceError[],
) {
  const value = source[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ path, message: `${label} is required.` });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > FIELD_LIMITS[field]) {
    errors.push({ path, message: `${label} must be ${FIELD_LIMITS[field]} characters or fewer.` });
    return undefined;
  }

  return normalized;
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateSubmissionEvidence(payload: unknown): SubmissionEvidenceResult {
  const errors: SubmissionEvidenceError[] = [];

  if (!isRecord(payload) || !Array.isArray(payload.evidenceSources) || payload.evidenceSources.length === 0) {
    return {
      ok: false,
      errors: [{ path: "evidenceSources", message: "Add at least one evidence source." }],
    };
  }

  if (payload.evidenceSources.length > MAX_EVIDENCE_SOURCES) {
    return {
      ok: false,
      errors: [{ path: "evidenceSources", message: `Add no more than ${MAX_EVIDENCE_SOURCES} evidence sources.` }],
    };
  }

  const normalized: SubmissionEvidenceSource[] = [];

  payload.evidenceSources.forEach((value, index) => {
    const prefix = `evidenceSources.${index}`;
    if (!isRecord(value)) {
      errors.push({ path: prefix, message: `Evidence source ${index + 1} must be an object.` });
      return;
    }

    const title = requiredText(value, "title", `${prefix}.title`, "Source title", errors);
    const url = requiredText(value, "url", `${prefix}.url`, "Source URL", errors);
    const claim = requiredText(value, "claim", `${prefix}.claim`, "Supported claim", errors);

    let validUrl: string | undefined;
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          errors.push({ path: `${prefix}.url`, message: "Source URL must use HTTPS." });
        } else {
          validUrl = parsed.toString();
        }
      } catch {
        errors.push({ path: `${prefix}.url`, message: "Enter a valid HTTPS URL." });
      }
    }

    const accessedAt = value.accessedAt;
    let validAccessedAt: string | undefined;
    if (typeof accessedAt !== "string" || accessedAt.trim().length === 0) {
      errors.push({ path: `${prefix}.accessedAt`, message: "Access date is required." });
    } else if (!isRealIsoDate(accessedAt.trim())) {
      errors.push({ path: `${prefix}.accessedAt`, message: "Use a real ISO date in YYYY-MM-DD format." });
    } else {
      validAccessedAt = accessedAt.trim();
    }

    const sourceType = value.sourceType;
    let validSourceType: EvidenceSourceType | undefined;
    if (typeof sourceType !== "string" || !SOURCE_TYPES.has(sourceType)) {
      errors.push({
        path: `${prefix}.sourceType`,
        message: "Choose an allowed first-party source type.",
      });
    } else {
      validSourceType = sourceType as EvidenceSourceType;
    }

    if (value.firstParty !== true) {
      errors.push({
        path: `${prefix}.firstParty`,
        message: "Confirm that this is a first-party source maintained by the product or project.",
      });
    }

    if (title && validUrl && claim && validAccessedAt && validSourceType) {
      normalized.push({
        title,
        url: validUrl,
        claim,
        accessedAt: validAccessedAt,
        sourceType: validSourceType,
      });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, evidenceSources: normalized };
}

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function handleSubmissionEvidenceRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SUBMISSION_EVIDENCE_REQUEST_BYTES) {
    return jsonResponse({ ok: false, error: "Request body is too large." }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_SUBMISSION_EVIDENCE_REQUEST_BYTES) {
    return jsonResponse({ ok: false, error: "Request body is too large." }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "Request body must be valid JSON." }, 400);
  }

  const result = validateSubmissionEvidence(payload);
  if (!result.ok) {
    return jsonResponse(result, 422);
  }

  return jsonResponse(
    {
      ...result,
      validationScope: "schema-only",
      message: "Required evidence fields and formats are valid. Editorial review must still verify source ownership, claim support, and listing eligibility.",
    },
    200,
  );
}
