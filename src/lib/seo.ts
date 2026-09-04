import type {
  Category,
  EvidenceSource,
  ToolCardData,
  ToolEntityType,
} from "./content";
import { formatClassification } from "./classification";
import { siteConfig } from "./site";

const SCHEMA_CONTEXT = "https://schema.org";

export type SchemaNode = Record<string, unknown>;

export interface SchemaImage {
  url: string;
  width?: number;
  height?: number;
  type?: string;
  caption?: string;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface DirectoryListItem {
  name: string;
  path: string;
  description?: string;
}

export function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString();
}

/**
 * Serialize structured data for use with Astro's set:html directive.
 * Escaping `<` is particularly important because JSON may contain `</script>`
 * in user-contributed text even though the JSON itself is valid.
 */
export function serializeJsonLd(value: unknown): string {
  return (JSON.stringify(value) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function schemaId(path: string, fragment: string) {
  const url = new URL(path, siteConfig.url);
  url.hash = "";
  return `${url.toString()}#${fragment}`;
}

function withoutContext(node: SchemaNode): SchemaNode {
  const { "@context": _context, ...rest } = node;
  return rest;
}

function schemaReference(value: string | SchemaNode | undefined): SchemaNode | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return { "@id": value };
  }

  const id = value["@id"];
  return typeof id === "string" ? { "@id": id } : value;
}

function schemaImage(image: string | SchemaImage | undefined): string | SchemaNode | undefined {
  if (!image) {
    return undefined;
  }

  if (typeof image === "string") {
    return image;
  }

  return {
    "@type": "ImageObject",
    url: image.url,
    contentUrl: image.url,
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
    ...(image.type ? { encodingFormat: image.type } : {}),
    ...(image.caption ? { caption: image.caption } : {}),
  };
}

function personOrOrganization(
  value: string | SchemaNode | undefined,
  defaultType: "Organization" | "Person" = "Person",
): SchemaNode | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value === "string"
    ? { "@type": defaultType, name: value }
    : value;
}

function dateOnly(value: string | undefined) {
  return value?.slice(0, 10);
}

function plainText(value: string | undefined) {
  const text = value
    ?.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]\s)\s*/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || undefined;
}

function citationNodes(sources: EvidenceSource[] | undefined): SchemaNode[] {
  return (sources ?? []).map((source) => ({
    "@type": "CreativeWork",
    name: source.title,
    url: source.url,
    description: source.claim,
  }));
}

export interface PublisherSchemaOptions {
  id?: string;
  type?: "Organization" | "Person";
  name?: string;
  url?: string;
  description?: string;
  logo?: string | SchemaImage;
  sameAs?: string[];
}

export function publisherSchema(options: PublisherSchemaOptions = {}): SchemaNode {
  const logo = schemaImage(options.logo);
  const sameAs = (options.sameAs ?? [siteConfig.publisherGithubUrl]).filter(Boolean);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": options.type ?? siteConfig.publisherType,
    "@id": options.id ?? schemaId("/", "publisher"),
    name: options.name ?? siteConfig.publisherName,
    url: options.url ?? siteConfig.publisherUrl,
    description: options.description ?? siteConfig.publisherDescription,
    ...(logo ? { logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export interface WebsiteSchemaOptions {
  id?: string;
  name?: string;
  alternateName?: string;
  url?: string;
  description?: string;
  inLanguage?: string;
  publisher?: string | SchemaNode | false;
}

export function websiteSchema(options: WebsiteSchemaOptions = {}): SchemaNode {
  const publisher = options.publisher === false
    ? undefined
    : schemaReference(options.publisher ?? schemaId("/", "publisher"));

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": options.id ?? schemaId("/", "website"),
    name: options.name ?? siteConfig.name,
    alternateName: options.alternateName ?? siteConfig.shortName,
    url: options.url ?? absoluteUrl("/"),
    description: options.description ?? siteConfig.description,
    inLanguage: options.inLanguage ?? "en",
    ...(publisher ? { publisher } : {}),
  };
}

export interface BreadcrumbSchemaOptions {
  path?: string;
  id?: string;
}

export function breadcrumbSchema(
  items: BreadcrumbItem[],
  options: BreadcrumbSchemaOptions | string = {},
): SchemaNode {
  const resolvedOptions = typeof options === "string" ? { path: options } : options;
  const path = resolvedOptions.path ?? items.at(-1)?.path ?? "/";

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    "@id": resolvedOptions.id ?? schemaId(path, "breadcrumb"),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export interface WebPageSchemaOptions {
  path: string;
  name: string;
  description?: string;
  type?: string | string[];
  id?: string;
  url?: string;
  inLanguage?: string;
  isPartOf?: string | SchemaNode | false;
  publisher?: string | SchemaNode | false;
  breadcrumb?: string | SchemaNode;
  mainEntity?: string | SchemaNode;
  about?: string | SchemaNode;
  image?: string | SchemaImage;
  datePublished?: string;
  dateModified?: string;
  lastReviewed?: string;
  reviewedBy?: string | SchemaNode;
  citations?: EvidenceSource[];
}

export function webPageSchema(options: WebPageSchemaOptions): SchemaNode {
  const isPartOf = options.isPartOf === false
    ? undefined
    : schemaReference(options.isPartOf ?? schemaId("/", "website"));
  const publisher = options.publisher === false
    ? undefined
    : schemaReference(options.publisher ?? schemaId("/", "publisher"));
  const breadcrumb = schemaReference(options.breadcrumb);
  const mainEntity = schemaReference(options.mainEntity);
  const about = typeof options.about === "string"
    ? { "@type": "Thing", name: options.about }
    : options.about;
  const image = schemaImage(options.image);
  const reviewedBy = personOrOrganization(options.reviewedBy);
  const citations = citationNodes(options.citations);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": options.type ?? "WebPage",
    "@id": options.id ?? schemaId(options.path, "webpage"),
    url: options.url ?? absoluteUrl(options.path),
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    inLanguage: options.inLanguage ?? "en",
    ...(isPartOf ? { isPartOf } : {}),
    ...(publisher ? { publisher } : {}),
    ...(breadcrumb ? { breadcrumb } : {}),
    ...(mainEntity ? { mainEntity } : {}),
    ...(about ? { about } : {}),
    ...(image ? { primaryImageOfPage: image } : {}),
    ...(options.datePublished ? { datePublished: options.datePublished } : {}),
    ...(options.dateModified ? { dateModified: options.dateModified } : {}),
    ...(options.lastReviewed ? { lastReviewed: dateOnly(options.lastReviewed) } : {}),
    ...(reviewedBy ? { reviewedBy } : {}),
    ...(citations.length ? { citation: citations } : {}),
  };
}

export interface PageGraphSchemaOptions extends WebPageSchemaOptions {
  breadcrumbs?: BreadcrumbItem[];
  entities?: SchemaNode[];
  includeSiteIdentity?: boolean;
}

/** Build one connected JSON-LD graph for a page and its site-level identity. */
export function pageGraphSchema(options: PageGraphSchemaOptions): SchemaNode {
  const {
    breadcrumbs,
    entities = [],
    includeSiteIdentity = true,
    ...pageOptions
  } = options;
  const breadcrumb = breadcrumbs?.length
    ? breadcrumbSchema(breadcrumbs, { path: options.path })
    : undefined;
  const mainEntity = pageOptions.mainEntity
    ?? entities.find((entity) => typeof entity["@id"] === "string");
  const page = webPageSchema({
    ...pageOptions,
    ...(breadcrumb && !pageOptions.breadcrumb ? { breadcrumb } : {}),
    ...(mainEntity ? { mainEntity } : {}),
  });

  return schemaGraph(
    ...(includeSiteIdentity ? [publisherSchema(), websiteSchema()] : []),
    page,
    breadcrumb,
    ...entities,
  );
}

/** Combine standalone schema nodes into a single JSON-LD @graph document. */
export function schemaGraph(
  ...values: Array<SchemaNode | SchemaNode[] | null | undefined | false>
): SchemaNode {
  const nodes = values.flatMap((value) => {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  });

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": nodes.map(withoutContext),
  };
}

export interface ItemListSchemaOptions {
  id?: string;
  name?: string;
  description?: string;
  /** Ordered lists emit ListItem positions. Unordered lists emit direct WebPage items. */
  ordered?: boolean;
  /** Sort by path before serializing. Useful for randomized visible collections. */
  stable?: boolean;
}

export function itemListSchema(
  items: DirectoryListItem[],
  path: string,
  options: ItemListSchemaOptions = {},
): SchemaNode {
  const ordered = options.ordered ?? true;
  const resolvedItems = options.stable
    ? [...items].sort((left, right) => {
        if (left.path === right.path) {
          return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
        }

        return left.path < right.path ? -1 : 1;
      })
    : items;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    "@id": options.id ?? schemaId(path, "itemlist"),
    url: absoluteUrl(path),
    ...(options.name ? { name: options.name } : {}),
    ...(options.description ? { description: options.description } : {}),
    numberOfItems: resolvedItems.length,
    ...(ordered
      ? {
          itemListElement: resolvedItems.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(item.path),
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
          })),
        }
      : {
          itemListOrder: "https://schema.org/ItemListUnordered",
          itemListElement: resolvedItems.map((item) => ({
            "@type": "WebPage",
            "@id": schemaId(item.path, "webpage"),
            url: absoluteUrl(item.path),
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
          })),
        }),
  };
}

export interface HomepageCollectionSchemaOptions {
  name?: string;
  description?: string;
}

type HomepageCollectionItem = DirectoryListItem | ToolCardData;

function normalizeHomepageItems(items: HomepageCollectionItem[]): DirectoryListItem[] {
  return items.map((item) => "entry" in item
    ? {
        name: item.entry.name,
        path: `/tools/${item.entry.slug}`,
        description: item.entry.description,
      }
    : item);
}

export function homepageItemListSchema(
  items: HomepageCollectionItem[],
  path = "/",
  options: HomepageCollectionSchemaOptions = {},
): SchemaNode {
  const description = options.description ?? siteConfig.description;

  return itemListSchema(normalizeHomepageItems(items), path, {
    id: schemaId(path, "directory-items"),
    name: options.name ?? "Agent-first tools",
    description,
    ordered: false,
    stable: true,
  });
}

/**
 * Describe the randomized homepage without implying that its current card order
 * is a ranking. Items are serialized in a stable path order with no positions.
 */
export function homepageCollectionSchema(
  items: HomepageCollectionItem[],
  path = "/",
  options: HomepageCollectionSchemaOptions = {},
): SchemaNode {
  const name = options.name ?? siteConfig.name;
  const description = options.description ?? siteConfig.description;
  const list = homepageItemListSchema(items, path, { description });
  const page = webPageSchema({
    path,
    name,
    description,
    type: "CollectionPage",
    mainEntity: schemaId(path, "directory-items"),
  });

  return { ...page, mainEntity: withoutContext(list) };
}

const TOOL_ENTITY_TYPES: Record<ToolEntityType, string> = {
  "software-application": "SoftwareApplication",
  "web-application": "WebApplication",
  "software-source-code": "SoftwareSourceCode",
  "web-api": "WebAPI",
  service: "Service",
  "technical-standard": "CreativeWork",
  protocol: "CreativeWork",
};

/** Values Google currently recognizes for SoftwareApplication rich results. */
export type SupportedApplicationCategory =
  | "GameApplication"
  | "SocialNetworkingApplication"
  | "TravelApplication"
  | "ShoppingApplication"
  | "SportsApplication"
  | "LifestyleApplication"
  | "BusinessApplication"
  | "DesignApplication"
  | "DeveloperApplication"
  | "DriverApplication"
  | "EducationalApplication"
  | "HealthApplication"
  | "FinanceApplication"
  | "SecurityApplication"
  | "BrowserApplication"
  | "CommunicationApplication"
  | "DesktopEnhancementApplication"
  | "EntertainmentApplication"
  | "MultimediaApplication"
  | "HomeApplication"
  | "UtilitiesApplication"
  | "ReferenceApplication";

export interface ToolEntitySchemaOptions {
  path?: string;
  entityType?: ToolEntityType | string;
  applicationCategory?: SupportedApplicationCategory;
  operatingSystem?: string | string[];
  isAccessibleForFree?: boolean;
  offers?: SchemaNode | SchemaNode[];
  aggregateRating?: SchemaNode;
  review?: SchemaNode | SchemaNode[];
}

function supplementalToolPages(tool: ToolCardData): SchemaNode[] {
  const pages = new Map<string, SchemaNode>();
  const addPage = (url: string | undefined, name: string, description?: string) => {
    if (!url || pages.has(url)) {
      return;
    }

    pages.set(url, {
      "@type": "WebPage",
      name,
      url,
      ...(description ? { description } : {}),
    });
  };

  addPage(tool.entry.docsUrl, `${tool.entry.name} documentation`);
  addPage(tool.entry.pricingUrl, `${tool.entry.name} pricing`);
  addPage(tool.entry.licenseUrl, `${tool.entry.name} license`);
  for (const source of tool.entry.evidenceSources ?? []) {
    addPage(source.url, source.title, source.claim);
  }

  return [...pages.values()];
}

export function toolEntitySchema(
  tool: ToolCardData,
  options: ToolEntitySchemaOptions = {},
): SchemaNode {
  const path = options.path ?? `/tools/${tool.entry.slug}`;
  const inferredEntityType: ToolEntityType = tool.entry.classification === "agent-internet-protocol"
    ? "protocol"
    : tool.entry.githubUrl
        && (tool.entry.pricing === "open-source" || tool.entry.pricing === "source-available")
      ? "software-source-code"
      : "service";
  const entityType = options.entityType ?? tool.entry.entityType ?? inferredEntityType;
  const type = Object.prototype.hasOwnProperty.call(TOOL_ENTITY_TYPES, entityType)
    ? TOOL_ENTITY_TYPES[entityType as ToolEntityType]
    : entityType;
  const isApplication = type === "SoftwareApplication"
    || type === "WebApplication"
    || type === "MobileApplication";
  const isSourceCode = type === "SoftwareSourceCode";
  const isWebApi = type === "WebAPI";
  const isService = type === "Service" || isWebApi;
  const isCreativeWork = isApplication || isSourceCode || type === "CreativeWork";
  const imageUrl = tool.entry.ogImageUrl ?? tool.entry.logoUrl;
  const image = imageUrl
    ? schemaImage({
        url: imageUrl,
        width: tool.entry.ogImageUrl ? tool.entry.ogImageWidth : tool.entry.logoWidth,
        height: tool.entry.ogImageUrl ? tool.entry.ogImageHeight : tool.entry.logoHeight,
        caption: `${tool.entry.name} image`,
      })
    : undefined;
  const sameAs = [tool.entry.githubUrl].filter((url): url is string => Boolean(url));
  const developer = tool.entry.developerName
    ? personOrOrganization(tool.entry.developerName, "Organization")
    : undefined;
  const subjects = supplementalToolPages(tool);
  const keywords = [
    ...(tool.entry.tags ?? []),
    ...(tool.entry.interfaces ?? []),
    ...(tool.entry.deploymentModes ?? []),
  ].filter(Boolean);
  const featureList = [
    ...(tool.entry.interfaces ?? []).map((value) => `Interface: ${value}`),
    ...(tool.entry.deploymentModes ?? []).map((value) => `Deployment: ${value}`),
  ];
  const classification = tool.entry.classification
    ? formatClassification(tool.entry.classification)
    : undefined;
  const genre = [tool.category.label, classification].filter((value): value is string => Boolean(value));

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": type,
    "@id": schemaId(path, "tool"),
    name: tool.entry.name,
    description: tool.entry.description,
    url: tool.entry.websiteUrl,
    mainEntityOfPage: { "@id": schemaId(path, "webpage") },
    ...(image ? { image } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(keywords.length && isCreativeWork ? { keywords } : {}),
    ...(genre.length && isCreativeWork ? { genre } : {}),
    ...(isService ? { category: tool.category.label } : {}),
    ...(developer && isService ? { provider: developer } : {}),
    ...(developer && isCreativeWork ? { creator: developer } : {}),
    ...(isApplication ? { applicationSubCategory: tool.category.label } : {}),
    ...(isApplication && options.applicationCategory
      ? { applicationCategory: options.applicationCategory }
      : {}),
    ...(isApplication && options.operatingSystem
      ? { operatingSystem: options.operatingSystem }
      : {}),
    ...(isApplication && typeof options.isAccessibleForFree === "boolean"
      ? { isAccessibleForFree: options.isAccessibleForFree }
      : {}),
    ...(isApplication && featureList.length ? { featureList } : {}),
    ...(isSourceCode && tool.entry.githubUrl ? { codeRepository: tool.entry.githubUrl } : {}),
    ...(isWebApi && tool.entry.docsUrl ? { documentation: tool.entry.docsUrl } : {}),
    ...(isCreativeWork && tool.entry.licenseUrl ? { license: tool.entry.licenseUrl } : {}),
    ...(subjects.length ? { subjectOf: subjects } : {}),
    ...(options.offers ? { offers: options.offers } : {}),
    ...(options.aggregateRating ? { aggregateRating: options.aggregateRating } : {}),
    ...(options.review ? { review: options.review } : {}),
  };
}

/** Kept for existing route imports; the emitted type now follows each entry. */
export function softwareApplicationSchema(
  tool: ToolCardData,
  options: ToolEntitySchemaOptions = {},
) {
  return toolEntitySchema(tool, options);
}

export interface CollectionPageSchemaOptions {
  name?: string;
  description?: string;
}

export function collectionPageSchema(
  category: Category,
  tools: ToolCardData[],
  path: string,
  options: CollectionPageSchemaOptions = {},
): SchemaNode {
  const name = options.name ?? category.seoTitle ?? `${category.label} tools`;
  const description = options.description
    ?? plainText(category.descriptionMd)
    ?? `Browse approved ${category.label.toLowerCase()} tools built for agent-first workflows.`;
  const itemList = itemListSchema(
    tools.map((tool) => ({
      name: tool.entry.name,
      path: `/tools/${tool.entry.slug}`,
      description: tool.entry.description,
    })),
    path,
    {
      name: `${category.label} tools`,
      description,
      ordered: true,
    },
  );
  const categoryDefinition = plainText(category.definitionMd);
  const reviewedBy = personOrOrganization(category.reviewedBy);
  const citations = citationNodes(category.sources);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "CollectionPage",
    "@id": schemaId(path, "webpage"),
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: "en",
    isPartOf: { "@id": schemaId("/", "website") },
    publisher: { "@id": schemaId("/", "publisher") },
    breadcrumb: { "@id": schemaId(path, "breadcrumb") },
    about: {
      "@type": "DefinedTerm",
      "@id": schemaId(path, "category"),
      name: category.label,
      ...(categoryDefinition ? { description: categoryDefinition } : {}),
    },
    mainEntity: withoutContext(itemList),
    ...(category.publishedAt ? { datePublished: category.publishedAt } : {}),
    ...(category.contentModifiedAt ? { dateModified: category.contentModifiedAt } : {}),
    ...(category.reviewedAt ? { lastReviewed: dateOnly(category.reviewedAt) } : {}),
    ...(reviewedBy ? { reviewedBy } : {}),
    ...(citations.length ? { citation: citations } : {}),
  };
}
