import type { Category, ToolCardData } from "./content";
import { formatClassification } from "./classification";
import { siteConfig } from "./site";

export function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString();
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListSchema(
  items: Array<{ name: string; path: string; description?: string }>,
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: absoluteUrl(path),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(item.path),
      name: item.name,
      description: item.description,
    })),
  };
}

export function softwareApplicationSchema(tool: ToolCardData) {
  const pageUrl = absoluteUrl(`/tools/${tool.entry.slug}`);
  const sameAs = [tool.entry.githubUrl].filter(Boolean);
  const image = tool.entry.ogImageUrl ?? tool.entry.logoUrl;

  return {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": `${pageUrl}#tool`,
    name: tool.entry.name,
    description: tool.entry.description,
    applicationCategory: tool.category.label,
    url: tool.entry.websiteUrl,
    mainEntityOfPage: pageUrl,
    operatingSystem: "Web",
    keywords: tool.entry.tags.join(", "),
    isAccessibleForFree: tool.entry.pricing !== "paid",
    ...(tool.entry.classification
      ? {
          additionalProperty: [
            {
              "@type": "PropertyValue",
              name: "Agent-first classification",
              value: formatClassification(tool.entry.classification),
            },
          ],
        }
      : {}),
    ...(image ? { image } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function collectionPageSchema(
  category: Category,
  tools: ToolCardData[],
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} tools`,
    description: `Browse approved ${category.label.toLowerCase()} tools built for agent-first workflows.`,
    url: absoluteUrl(path),
    mainEntity: itemListSchema(
      tools.map((tool) => ({
        name: tool.entry.name,
        path: `/tools/${tool.entry.slug}`,
        description: tool.entry.description,
      })),
      path,
    ),
  };
}
