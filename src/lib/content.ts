import { env } from "cloudflare:workers";
import type { Classification } from "./classification";
import { normalizeClassification } from "./classification";
import { getStaticPageEntries } from "./static-pages";
import { shuffleCopy, type RandomSource } from "./homepage-order";

export type { Classification } from "./classification";

export type Pricing = "open-source" | "source-available" | "freemium" | "free" | "paid" | "unknown";

export type VerificationLevel =
  | "documentation-reviewed"
  | "vendor-confirmed"
  | "hands-on-tested";

export type ToolEntityType =
  | "software-application"
  | "web-application"
  | "software-source-code"
  | "web-api"
  | "service"
  | "technical-standard"
  | "protocol";

export interface EvidenceSource {
  title: string;
  url: string;
  claim: string;
  accessedAt?: string;
  sourceType?: string;
}

export interface Category {
  slug: string;
  label: string;
  sortOrder?: number;
  seoTitle?: string;
  descriptionMd?: string;
  definitionMd?: string;
  scopeMd?: string;
  inclusionMd?: string;
  exclusionMd?: string;
  selectionGuideMd?: string;
  useCases: string[];
  sources: EvidenceSource[];
  reviewedBy?: string;
  reviewedAt?: string;
  publishedAt?: string;
  contentModifiedAt?: string;
  isIndexable: boolean;
}

export interface Tool {
  slug: string;
  name: string;
  description: string;
  bodyMd: string;
  categorySlug: string;
  tags: string[];
  websiteUrl: string;
  githubUrl?: string;
  pricing: Pricing;
  classification?: Classification;
  submittedByGithub: string;
  logoUrl?: string;
  ogImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  ogImageWidth?: number;
  ogImageHeight?: number;
  entityType?: ToolEntityType;
  developerName?: string;
  docsUrl?: string;
  pricingUrl?: string;
  licenseUrl?: string;
  interfaces: string[];
  deploymentModes: string[];
  evidenceSources: EvidenceSource[];
  verificationLevel?: VerificationLevel;
  classificationRationaleMd?: string;
  inclusionRationaleMd?: string;
  bestForMd?: string;
  notBestForMd?: string;
  limitationsMd?: string;
  unknownsMd?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedAt?: string;
  contentModifiedAt?: string;
  sourcePath: string;
  isIndexable: boolean;
  sortOrder?: number;
  syncedAt?: string;
}

export interface ToolCardData {
  entry: Tool;
  category: Category;
  pricingLabel: string;
}

export interface SitemapEntry {
  path: string;
  lastModified?: string;
}

interface CategoryRow {
  slug: string;
  label: string;
  sort_order: number | null;
  seo_title: string | null;
  description_md: string | null;
  definition_md: string | null;
  scope_md: string | null;
  inclusion_md: string | null;
  exclusion_md: string | null;
  selection_guide_md: string | null;
  use_cases_json: string | null;
  sources_json: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  content_modified_at: string | null;
  is_indexable: number;
}

interface ToolRow {
  slug: string;
  name: string;
  description: string;
  body_md: string;
  category_slug: string;
  tags_json: string;
  website_url: string;
  github_url: string | null;
  pricing: Pricing;
  classification: Classification | null;
  submitted_by_github: string;
  logo_url: string | null;
  og_image_url: string | null;
  logo_width: number | null;
  logo_height: number | null;
  og_image_width: number | null;
  og_image_height: number | null;
  entity_type: ToolEntityType | null;
  developer_name: string | null;
  docs_url: string | null;
  pricing_url: string | null;
  license_url: string | null;
  interfaces_json: string | null;
  deployment_modes_json: string | null;
  evidence_json: string | null;
  verification_level: VerificationLevel | null;
  classification_rationale_md: string | null;
  inclusion_rationale_md: string | null;
  best_for_md: string | null;
  not_best_for_md: string | null;
  limitations_md: string | null;
  unknowns_md: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  content_modified_at: string | null;
  source_path: string;
  is_indexable: number;
  sort_order: number | null;
  synced_at: string | null;
  category_label: string;
  category_sort_order: number | null;
  category_is_indexable: number;
}

const CATEGORY_ORDER = `
  CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,
  sort_order,
  label COLLATE NOCASE
`;

const TOOL_ORDER = `
  CASE WHEN t.sort_order IS NULL THEN 1 ELSE 0 END,
  t.sort_order,
  t.name COLLATE NOCASE
`;

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

function sanitizeExternalUrl(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getDb() {
  if (!env.DB) {
    throw new Error("Missing Cloudflare D1 binding 'DB'.");
  }

  return env.DB;
}

function mapCategory(row: CategoryRow): Category {
  return {
    slug: row.slug,
    label: row.label,
    sortOrder: row.sort_order ?? undefined,
    seoTitle: row.seo_title ?? undefined,
    descriptionMd: row.description_md ?? undefined,
    definitionMd: row.definition_md ?? undefined,
    scopeMd: row.scope_md ?? undefined,
    inclusionMd: row.inclusion_md ?? undefined,
    exclusionMd: row.exclusion_md ?? undefined,
    selectionGuideMd: row.selection_guide_md ?? undefined,
    useCases: parseStringArray(row.use_cases_json),
    sources: parseEvidenceSources(row.sources_json),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: normalizeDate(row.reviewed_at),
    publishedAt: normalizeDate(row.published_at),
    contentModifiedAt: normalizeDate(row.content_modified_at),
    isIndexable: row.is_indexable !== 0,
  };
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const items = JSON.parse(value);
    return Array.isArray(items)
      ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseEvidenceSources(value: string | null | undefined): EvidenceSource[] {
  if (!value) {
    return [];
  }

  try {
    const sources = JSON.parse(value);

    if (!Array.isArray(sources)) {
      return [];
    }

    return sources.flatMap((source) => {
      if (!source || typeof source !== "object") {
        return [];
      }

      const record = source as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const claim = typeof record.claim === "string" ? record.claim.trim() : "";
      const url = typeof record.url === "string" ? sanitizeExternalUrl(record.url) : undefined;

      if (!title || !claim || !url) {
        return [];
      }

      return [{
        title,
        claim,
        url,
        accessedAt: typeof record.accessedAt === "string" ? normalizeDate(record.accessedAt) : undefined,
        sourceType: typeof record.sourceType === "string" ? record.sourceType : undefined,
      }];
    });
  } catch {
    return [];
  }
}

function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function mapToolCard(row: ToolRow): ToolCardData {
  const websiteUrl = sanitizeExternalUrl(row.website_url);

  if (!websiteUrl) {
    throw new Error(`Tool "${row.slug}" is missing a valid public website URL.`);
  }

  return {
    entry: {
      slug: row.slug,
      name: row.name,
      description: row.description,
      bodyMd: row.body_md,
      categorySlug: row.category_slug,
      tags: parseStringArray(row.tags_json),
      websiteUrl,
      githubUrl: sanitizeExternalUrl(row.github_url),
      pricing: row.pricing,
      classification: normalizeClassification(row.classification),
      submittedByGithub: row.submitted_by_github,
      logoUrl: sanitizeExternalUrl(row.logo_url),
      ogImageUrl: sanitizeExternalUrl(row.og_image_url),
      logoWidth: row.logo_width ?? undefined,
      logoHeight: row.logo_height ?? undefined,
      ogImageWidth: row.og_image_width ?? undefined,
      ogImageHeight: row.og_image_height ?? undefined,
      entityType: row.entity_type ?? undefined,
      developerName: row.developer_name ?? undefined,
      docsUrl: sanitizeExternalUrl(row.docs_url),
      pricingUrl: sanitizeExternalUrl(row.pricing_url),
      licenseUrl: sanitizeExternalUrl(row.license_url),
      interfaces: parseStringArray(row.interfaces_json),
      deploymentModes: parseStringArray(row.deployment_modes_json),
      evidenceSources: parseEvidenceSources(row.evidence_json),
      verificationLevel: row.verification_level ?? undefined,
      classificationRationaleMd: row.classification_rationale_md ?? undefined,
      inclusionRationaleMd: row.inclusion_rationale_md ?? undefined,
      bestForMd: row.best_for_md ?? undefined,
      notBestForMd: row.not_best_for_md ?? undefined,
      limitationsMd: row.limitations_md ?? undefined,
      unknownsMd: row.unknowns_md ?? undefined,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: normalizeDate(row.reviewed_at),
      publishedAt: normalizeDate(row.published_at),
      contentModifiedAt: normalizeDate(row.content_modified_at),
      sourcePath: row.source_path,
      isIndexable: row.is_indexable !== 0,
      sortOrder: row.sort_order ?? undefined,
      syncedAt: row.synced_at ?? undefined,
    },
    category: {
      slug: row.category_slug,
      label: row.category_label,
      sortOrder: row.category_sort_order ?? undefined,
      useCases: [],
      sources: [],
      isIndexable: row.category_is_indexable !== 0,
    },
    pricingLabel: formatPricing(row.pricing),
  };
}

async function queryToolCards(
  whereClause = "",
  bindings: unknown[] = [],
  { includeNoindex = false }: { includeNoindex?: boolean } = {},
) {
  const statement = getDb()
    .prepare(
      `
        SELECT
          t.slug,
          t.name,
          t.description,
          t.body_md,
          t.category_slug,
          t.tags_json,
          t.website_url,
          t.github_url,
          t.pricing,
          t.classification,
          t.submitted_by_github,
          t.logo_url,
          t.og_image_url,
          t.logo_width,
          t.logo_height,
          t.og_image_width,
          t.og_image_height,
          t.entity_type,
          t.developer_name,
          t.docs_url,
          t.pricing_url,
          t.license_url,
          t.interfaces_json,
          t.deployment_modes_json,
          t.evidence_json,
          t.verification_level,
          t.classification_rationale_md,
          t.inclusion_rationale_md,
          t.best_for_md,
          t.not_best_for_md,
          t.limitations_md,
          t.unknowns_md,
          t.reviewed_by,
          t.reviewed_at,
          t.published_at,
          t.content_modified_at,
          t.source_path,
          t.is_indexable,
          t.sort_order,
          t.synced_at,
          c.label AS category_label,
          c.sort_order AS category_sort_order,
          c.is_indexable AS category_is_indexable
        FROM tools t
        INNER JOIN categories c
          ON c.slug = t.category_slug
         AND c.is_active = 1
        WHERE t.is_published = 1
        ${includeNoindex ? "" : "AND t.is_indexable = 1 AND c.is_indexable = 1"}
        ${whereClause}
        ORDER BY ${TOOL_ORDER}
      `,
    )
    .bind(...bindings);
  const { results = [] } = await statement.all<ToolRow>();
  const tools: ToolCardData[] = [];

  for (const row of results) {
    try {
      tools.push(mapToolCard(row));
    } catch {
      // Skip malformed external URLs so they never reach rendering.
    }
  }

  return tools;
}

export async function getCategories() {
  const statement = getDb().prepare(
    `
      SELECT
        c.slug,
        c.label,
        c.sort_order,
        c.seo_title,
        c.description_md,
        c.definition_md,
        c.scope_md,
        c.inclusion_md,
        c.exclusion_md,
        c.selection_guide_md,
        c.use_cases_json,
        c.sources_json,
        c.reviewed_by,
        c.reviewed_at,
        c.published_at,
        c.content_modified_at,
        c.is_indexable
      FROM categories c
      WHERE c.is_active = 1
        AND c.is_indexable = 1
        AND EXISTS (
          SELECT 1
          FROM tools t
          WHERE t.category_slug = c.slug
            AND t.is_published = 1
            AND t.is_indexable = 1
        )
      ORDER BY ${CATEGORY_ORDER}
    `,
  );
  const { results = [] } = await statement.all<CategoryRow>();
  return results.map(mapCategory);
}

export async function getCategoryBySlug(slug: string) {
  const statement = getDb()
    .prepare(
      `
        SELECT
          slug,
          label,
          sort_order,
          seo_title,
          description_md,
          definition_md,
          scope_md,
          inclusion_md,
          exclusion_md,
          selection_guide_md,
          use_cases_json,
          sources_json,
          reviewed_by,
          reviewed_at,
          published_at,
          content_modified_at,
          is_indexable
        FROM categories
        WHERE slug = ?1
          AND is_active = 1
      `,
    )
    .bind(slug);
  const result = await statement.first<CategoryRow>();
  return result ? mapCategory(result) : null;
}

export async function getHomepageData(random: RandomSource = Math.random) {
  const [categories, tools] = await Promise.all([getCategories(), queryToolCards()]);
  return { categories, tools: shuffleCopy(tools, random) };
}

export async function getPublishedTools() {
  return queryToolCards();
}

export async function getToolBySlug(slug: string) {
  const [tool] = await queryToolCards("AND t.slug = ?1", [slug], { includeNoindex: true });
  return tool ?? null;
}

export async function getToolsByCategory(slug: string) {
  return queryToolCards("AND t.category_slug = ?1", [slug]);
}

export async function getRelatedTools(tool: ToolCardData, limit = 3) {
  const candidates = await queryToolCards("AND t.slug <> ?1", [tool.entry.slug]);
  const toolTags = new Set(tool.entry.tags.map((tag) => tag.toLowerCase()));
  const toolInterfaces = new Set(tool.entry.interfaces.map((item) => item.toLowerCase()));

  return candidates
    .map((candidate) => {
      const sharedTags = candidate.entry.tags.filter((tag) => toolTags.has(tag.toLowerCase())).length;
      const sharedInterfaces = candidate.entry.interfaces.filter((item) =>
        toolInterfaces.has(item.toLowerCase()),
      ).length;
      const score =
        (candidate.category.slug === tool.category.slug ? 5 : 0) +
        sharedTags * 2 +
        sharedInterfaces * 2 +
        (candidate.entry.classification === tool.entry.classification ? 1 : 0);

      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.entry.name.localeCompare(right.candidate.entry.name))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function getSitemapStaticEntries(): SitemapEntry[] {
  return getStaticPageEntries();
}

export async function getSitemapToolEntries() {
  const tools = await queryToolCards();
  return tools
    .toSorted((left, right) => left.entry.slug.localeCompare(right.entry.slug))
    .map((tool) => ({
    path: `/tools/${tool.entry.slug}`,
    lastModified: tool.entry.contentModifiedAt ?? tool.entry.publishedAt,
  }));
}

export async function getSitemapCategoryEntries() {
  const categories = await getCategories();
  const categoryTools = await Promise.all(
    categories.map(async (category) => ({ category, tools: await getToolsByCategory(category.slug) })),
  );

  return categoryTools.map(({ category, tools }) => {
    const dates = [
      category.contentModifiedAt,
      category.publishedAt,
      ...tools.flatMap((tool) => [tool.entry.contentModifiedAt, tool.entry.publishedAt]),
    ].filter((value): value is string => Boolean(value));

    return {
      path: `/category/${category.slug}`,
      lastModified: dates.toSorted().at(-1),
    };
  });
}

export function isOpenSourceTool(tool: Tool | ToolCardData) {
  const entry = "entry" in tool ? tool.entry : tool;
  return entry.pricing === "open-source";
}

export function formatPricing(pricing: Pricing) {
  switch (pricing) {
    case "open-source":
      return "Open Source";
    case "source-available":
      return "Source Available";
    case "freemium":
      return "Freemium";
    case "free":
      return "Free";
    case "paid":
      return "Paid";
    case "unknown":
      return "Pricing not documented";
    default:
      return pricing;
  }
}

export function toolHref(tool: Tool) {
  return `/tools/${tool.slug}`;
}

export function categoryHref(category: Category) {
  return `/category/${category.slug}`;
}
