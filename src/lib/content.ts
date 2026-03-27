import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type ToolEntry = CollectionEntry<"tools">;
export type CategoryEntry = CollectionEntry<"categories">;

export interface ToolCardData {
  entry: ToolEntry;
  category: CategoryEntry;
  pricingLabel: string;
}

function sortByOrderThenName<T extends { data: { sortOrder?: number; name?: string; label?: string } }>(
  items: T[],
) {
  return [...items].sort((left, right) => {
    const leftOrder = left.data.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.data.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftName = left.data.name ?? left.data.label ?? "";
    const rightName = right.data.name ?? right.data.label ?? "";
    return leftName.localeCompare(rightName);
  });
}

export async function getSortedCategories() {
  return sortByOrderThenName(await getCollection("categories"));
}

export async function getSortedTools() {
  return sortByOrderThenName(await getCollection("tools"));
}

export async function getResolvedCategory(reference: ToolEntry["data"]["category"]) {
  return getEntry(reference);
}

export async function toToolCards(tools: ToolEntry[]): Promise<ToolCardData[]> {
  return Promise.all(
    tools.map(async (entry) => ({
      entry,
      category: await getResolvedCategory(entry.data.category),
      pricingLabel: formatPricing(entry.data.pricing),
    })),
  );
}

export function isOpenSourceTool(tool: ToolEntry | ToolCardData) {
  const entry = "entry" in tool ? tool.entry : tool;
  return entry.data.pricing === "open-source";
}

export function formatPricing(pricing: ToolEntry["data"]["pricing"]) {
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

export function toolHref(tool: ToolEntry) {
  return `/tools/${tool.data.slug}`;
}

export function categoryHref(category: CategoryEntry) {
  return `/category/${category.data.slug}`;
}
