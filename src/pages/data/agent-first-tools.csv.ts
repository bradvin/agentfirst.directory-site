import type { APIRoute } from "astro";
import { cacheControl } from "../../lib/cache";
import { getPublishedTools } from "../../lib/content";
import { csvEscape } from "../../lib/data-export";

const columns = [
  "slug",
  "name",
  "profile_url",
  "source_url",
  "description",
  "overview_md",
  "category",
  "classification",
  "entity_type",
  "pricing",
  "pricing_url",
  "developer_name",
  "interfaces",
  "deployment_modes",
  "website_url",
  "github_url",
  "docs_url",
  "license_url",
  "verification_level",
  "classification_rationale_md",
  "inclusion_rationale_md",
  "best_for_md",
  "not_best_for_md",
  "limitations_md",
  "unknowns_md",
  "evidence_json",
  "reviewed_at",
  "published_at",
  "content_modified_at",
];

export const GET: APIRoute = async () => {
  const tools = await getPublishedTools();
  const rows = tools.map((tool) => [
    tool.entry.slug,
    tool.entry.name,
    `https://agentfirst.directory/tools/${tool.entry.slug}`,
    `https://github.com/bradvin/agentfirst.directory/blob/main/${tool.entry.sourcePath}`,
    tool.entry.description,
    tool.entry.bodyMd,
    tool.category.label,
    tool.entry.classification,
    tool.entry.entityType,
    tool.entry.pricing,
    tool.entry.pricingUrl,
    tool.entry.developerName,
    tool.entry.interfaces,
    tool.entry.deploymentModes,
    tool.entry.websiteUrl,
    tool.entry.githubUrl,
    tool.entry.docsUrl,
    tool.entry.licenseUrl,
    tool.entry.verificationLevel,
    tool.entry.classificationRationaleMd,
    tool.entry.inclusionRationaleMd,
    tool.entry.bestForMd,
    tool.entry.notBestForMd,
    tool.entry.limitationsMd,
    tool.entry.unknownsMd,
    JSON.stringify(tool.entry.evidenceSources),
    tool.entry.reviewedAt,
    tool.entry.publishedAt,
    tool.entry.contentModifiedAt,
  ]);
  const csv = [columns.map(csvEscape), ...rows.map((row) => row.map(csvEscape))]
    .map((row) => row.join(","))
    .join("\n");

  return new Response(`${csv}\n`, {
    headers: {
      "Cache-Control": cacheControl.data,
      "CDN-Cache-Control": cacheControl.dataCdn,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="agent-first-tools.csv"',
      "X-Robots-Tag": "index, follow",
    },
  });
};
