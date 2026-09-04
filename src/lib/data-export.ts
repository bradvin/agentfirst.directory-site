import type { ToolCardData } from "./content";
import { absoluteUrl } from "./seo";

export const dataReuseTerms = {
  name: "Agent First Directory data reuse terms",
  url: absoluteUrl("/editorial-standards#data-reuse"),
};

export function toolToPublicRecord(tool: ToolCardData) {
  const sourceUrl = `https://github.com/bradvin/agentfirst.directory/blob/main/${tool.entry.sourcePath}`;

  return {
    slug: tool.entry.slug,
    name: tool.entry.name,
    profileUrl: absoluteUrl(`/tools/${tool.entry.slug}`),
    sourceUrl,
    sourceHistoryUrl: `https://github.com/bradvin/agentfirst.directory/commits/main/${tool.entry.sourcePath}`,
    description: tool.entry.description,
    overviewMd: tool.entry.bodyMd,
    category: {
      slug: tool.category.slug,
      label: tool.category.label,
      url: absoluteUrl(`/category/${tool.category.slug}`),
    },
    classification: tool.entry.classification,
    entityType: tool.entry.entityType,
    tags: tool.entry.tags,
    pricing: tool.entry.pricing,
    websiteUrl: tool.entry.websiteUrl,
    githubUrl: tool.entry.githubUrl,
    docsUrl: tool.entry.docsUrl,
    pricingUrl: tool.entry.pricingUrl,
    licenseUrl: tool.entry.licenseUrl,
    developerName: tool.entry.developerName,
    interfaces: tool.entry.interfaces,
    deploymentModes: tool.entry.deploymentModes,
    verificationLevel: tool.entry.verificationLevel,
    classificationRationaleMd: tool.entry.classificationRationaleMd,
    inclusionRationaleMd: tool.entry.inclusionRationaleMd,
    bestForMd: tool.entry.bestForMd,
    notBestForMd: tool.entry.notBestForMd,
    limitationsMd: tool.entry.limitationsMd,
    unknownsMd: tool.entry.unknownsMd,
    evidenceSources: tool.entry.evidenceSources,
    reviewedBy: tool.entry.reviewedBy,
    reviewedAt: tool.entry.reviewedAt,
    publishedAt: tool.entry.publishedAt,
    contentModifiedAt: tool.entry.contentModifiedAt,
  };
}

export function csvEscape(value: unknown) {
  const serialized = Array.isArray(value)
    ? value.join("|")
    : value === null || value === undefined
      ? ""
      : String(value);
  return `"${serialized.replaceAll('"', '""')}"`;
}

export function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
