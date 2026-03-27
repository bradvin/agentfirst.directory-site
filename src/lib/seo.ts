import type { Category, ToolCardData } from "./content";
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
    name: tool.entry.name,
    description: tool.entry.description,
    applicationCategory: tool.category.label,
    url: absoluteUrl(`/tools/${tool.entry.slug}`),
    sameAs: [tool.entry.websiteUrl, tool.entry.githubUrl].filter(Boolean),
    author: {
      "@type": "Person",
      name: tool.entry.submittedByGithub,
      url: `https://github.com/${tool.entry.submittedByGithub}`,
    },
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
