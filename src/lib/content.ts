import { env } from "cloudflare:workers";

export type Pricing = "open-source" | "freemium" | "free" | "paid";

export interface Category {
  slug: string;
  label: string;
  sortOrder?: number;
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
  submittedByGithub: string;
  logoUrl?: string;
  ogImageUrl?: string;
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
  submitted_by_github: string;
  logo_url: string | null;
  og_image_url: string | null;
  sort_order: number | null;
  synced_at: string | null;
  category_label: string;
  category_sort_order: number | null;
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
  };
}

function parseTags(tagsJson: string): string[] {
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function mapToolCard(row: ToolRow): ToolCardData {
  return {
    entry: {
      slug: row.slug,
      name: row.name,
      description: row.description,
      bodyMd: row.body_md,
      categorySlug: row.category_slug,
      tags: parseTags(row.tags_json),
      websiteUrl: row.website_url,
      githubUrl: row.github_url ?? undefined,
      pricing: row.pricing,
      submittedByGithub: row.submitted_by_github,
      logoUrl: row.logo_url ?? undefined,
      ogImageUrl: row.og_image_url ?? undefined,
      sortOrder: row.sort_order ?? undefined,
      syncedAt: row.synced_at ?? undefined,
    },
    category: {
      slug: row.category_slug,
      label: row.category_label,
      sortOrder: row.category_sort_order ?? undefined,
    },
    pricingLabel: formatPricing(row.pricing),
  };
}

async function queryToolCards(whereClause = "", bindings: unknown[] = []) {
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
          t.submitted_by_github,
          t.logo_url,
          t.og_image_url,
          t.sort_order,
          t.synced_at,
          c.label AS category_label,
          c.sort_order AS category_sort_order
        FROM tools t
        INNER JOIN categories c
          ON c.slug = t.category_slug
         AND c.is_active = 1
        WHERE t.is_published = 1
        ${whereClause}
        ORDER BY ${TOOL_ORDER}
      `,
    )
    .bind(...bindings);
  const { results = [] } = await statement.all<ToolRow>();
  return results.map(mapToolCard);
}

export async function getCategories() {
  const statement = getDb().prepare(
    `
      SELECT slug, label, sort_order
      FROM categories
      WHERE is_active = 1
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
        SELECT slug, label, sort_order
        FROM categories
        WHERE slug = ?1
          AND is_active = 1
      `,
    )
    .bind(slug);
  const result = await statement.first<CategoryRow>();
  return result ? mapCategory(result) : null;
}

export async function getHomepageData() {
  const [categories, tools] = await Promise.all([getCategories(), queryToolCards()]);
  return { categories, tools };
}

export async function getToolBySlug(slug: string) {
  const [tool] = await queryToolCards("AND t.slug = ?1", [slug]);
  return tool ?? null;
}

export async function getToolsByCategory(slug: string) {
  return queryToolCards("AND t.category_slug = ?1", [slug]);
}

export function getSitemapStaticEntries(): SitemapEntry[] {
  return [{ path: "/" }, { path: "/submit" }];
}

export async function getSitemapToolEntries() {
  const statement = getDb().prepare(
    `
      SELECT slug, synced_at
      FROM tools
      WHERE is_published = 1
      ORDER BY slug COLLATE NOCASE
    `,
  );
  const { results = [] } = await statement.all<{ slug: string; synced_at: string | null }>();
  return results.map((row) => ({
    path: `/tools/${row.slug}`,
    lastModified: row.synced_at ?? undefined,
  }));
}

export async function getSitemapCategoryEntries() {
  const statement = getDb().prepare(
    `
      SELECT slug, synced_at
      FROM categories
      WHERE is_active = 1
      ORDER BY slug COLLATE NOCASE
    `,
  );
  const { results = [] } = await statement.all<{ slug: string; synced_at: string | null }>();
  return results.map((row) => ({
    path: `/category/${row.slug}`,
    lastModified: row.synced_at ?? undefined,
  }));
}

export function isOpenSourceTool(tool: Tool | ToolCardData) {
  const entry = "entry" in tool ? tool.entry : tool;
  return entry.pricing === "open-source";
}

export function formatPricing(pricing: Pricing) {
  switch (pricing) {
    case "open-source":
      return "Open Source";
    case "freemium":
      return "Freemium";
    case "free":
      return "Free";
    case "paid":
      return "Paid";
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
