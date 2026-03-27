import type { CategoryEntry, ToolCardData } from "./content";
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
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.entry.data.name,
    description: tool.entry.data.description,
    applicationCategory: tool.category.data.label,
    url: absoluteUrl(`/tools/${tool.entry.data.slug}`),
    sameAs: [tool.entry.data.websiteUrl, tool.entry.data.githubUrl].filter(Boolean),
    author: {
      "@type": "Person",
      name: tool.entry.data.submittedBy,
      url: `https://github.com/${tool.entry.data.submittedBy}`,
    },
  };
}

export function collectionPageSchema(
  category: CategoryEntry,
  tools: ToolCardData[],
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.data.label} tools`,
    description: `Browse approved ${category.data.label.toLowerCase()} tools built for agent-first workflows.`,
    url: absoluteUrl(path),
    mainEntity: itemListSchema(
      tools.map((tool) => ({
        name: tool.entry.data.name,
        path: `/tools/${tool.entry.data.slug}`,
        description: tool.entry.data.description,
      })),
      path,
    ),
  };
}
