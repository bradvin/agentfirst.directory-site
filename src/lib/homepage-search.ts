export interface SearchableToolFields {
  name: string;
  description: string;
  categoryLabel: string;
  tags: string[];
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function buildToolSearchText(tool: SearchableToolFields) {
  return normalizeSearchText(
    [tool.name, tool.description, tool.categoryLabel, ...tool.tags].join(" "),
  );
}

export function matchesToolSearch(searchText: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  return normalizedQuery === "" || searchText.includes(normalizedQuery);
}
