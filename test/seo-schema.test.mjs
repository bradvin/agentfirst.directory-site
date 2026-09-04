import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";

import { build } from "esbuild";

const bundleDirectory = mkdtempSync(join(tmpdir(), "agentfirst-seo-test-"));
const bundlePath = join(bundleDirectory, "seo.mjs");

await build({
  entryPoints: [new URL("../src/lib/seo.ts", import.meta.url).pathname],
  outfile: bundlePath,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  logLevel: "silent",
});

const {
  collectionPageSchema,
  homepageCollectionSchema,
  pageGraphSchema,
  serializeJsonLd,
  toolEntitySchema,
} = await import(pathToFileURL(bundlePath).href);

after(() => rmSync(bundleDirectory, { force: true, recursive: true }));

function makeTool(overrides = {}) {
  const entryOverrides = overrides.entry ?? {};
  const categoryOverrides = overrides.category ?? {};

  return {
    entry: {
      slug: "example-tool",
      name: "Example Tool",
      description: "An evidence-reviewed agent tool.",
      bodyMd: "Overview",
      categorySlug: "agent-infrastructure",
      tags: ["agents"],
      websiteUrl: "https://example.com",
      pricing: "paid",
      submittedByGithub: "maintainer",
      interfaces: [],
      deploymentModes: [],
      evidenceSources: [],
      sourcePath: "tools/example-tool.md",
      isIndexable: true,
      ...entryOverrides,
    },
    category: {
      slug: "agent-infrastructure",
      label: "Agent Infrastructure",
      useCases: [],
      sources: [],
      isIndexable: true,
      ...categoryOverrides,
    },
    pricingLabel: "Paid",
  };
}

function assertNoInventedCommerceOrPlatform(schema) {
  assert.equal(schema.operatingSystem, undefined);
  assert.equal(schema.isAccessibleForFree, undefined);
  assert.equal(schema.offers, undefined);
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.review, undefined);
}

test("serializeJsonLd neutralizes script termination and JSON-significant HTML characters", () => {
  const value = {
    text: "</script><script>alert('x')</script> & > \u2028 \u2029",
  };
  const serialized = serializeJsonLd(value);

  assert.doesNotMatch(serialized, /<\/script/i);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("pageGraphSchema connects publisher, WebSite, WebPage, breadcrumbs, and main entity", () => {
  const entity = toolEntitySchema(makeTool());
  const graphDocument = pageGraphSchema({
    path: "/tools/example-tool",
    name: "Example Tool profile",
    description: "Profile description",
    type: "ItemPage",
    breadcrumbs: [
      { name: "agent-first", path: "/" },
      { name: "Example Tool", path: "/tools/example-tool" },
    ],
    entities: [entity],
  });

  assert.equal(graphDocument["@context"], "https://schema.org");
  const graph = graphDocument["@graph"];
  assert.ok(Array.isArray(graph));
  const publisher = graph.find((node) => node["@id"]?.endsWith("#publisher"));
  const website = graph.find((node) => node["@type"] === "WebSite");
  const page = graph.find((node) => node["@type"] === "ItemPage");
  const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList");
  const describedEntity = graph.find((node) => node["@id"]?.endsWith("#tool"));

  assert.equal(publisher?.["@type"], "Person");
  assert.equal(publisher?.name, "Brad Vincent");
  assert.equal(publisher?.url, "https://agentfirst.directory/about");
  assert.equal(publisher?.description, "Publisher and maintainer of agentfirst.directory.");
  assert.deepEqual(publisher?.sameAs, ["https://github.com/bradvin"]);
  assert.deepEqual(website?.publisher, { "@id": publisher["@id"] });
  assert.deepEqual(page?.isPartOf, { "@id": website["@id"] });
  assert.deepEqual(page?.breadcrumb, { "@id": breadcrumb["@id"] });
  assert.deepEqual(page?.mainEntity, { "@id": describedEntity["@id"] });
  assert.equal(describedEntity?.mainEntityOfPage?.["@id"], page["@id"]);
});

test("tool schema honors explicit entity types and uses conservative fallbacks", () => {
  const protocol = toolEntitySchema(makeTool({
    entry: { classification: "agent-internet-protocol" },
  }));
  const sourceCode = toolEntitySchema(makeTool({
    entry: {
      pricing: "open-source",
      githubUrl: "https://github.com/example/tool",
    },
  }));
  const service = toolEntitySchema(makeTool());
  const webApi = toolEntitySchema(makeTool({
    entry: {
      entityType: "web-api",
      docsUrl: "https://example.com/docs",
    },
  }));

  assert.equal(protocol["@type"], "CreativeWork");
  assert.equal(sourceCode["@type"], "SoftwareSourceCode");
  assert.equal(sourceCode.codeRepository, "https://github.com/example/tool");
  assert.equal(service["@type"], "Service");
  assert.equal(webApi["@type"], "WebAPI");
  assert.equal(webApi.documentation, "https://example.com/docs");

  for (const schema of [protocol, sourceCode, service, webApi]) {
    assertNoInventedCommerceOrPlatform(schema);
  }
});

test("application-only properties appear only when explicitly supported", () => {
  const application = toolEntitySchema(
    makeTool({ entry: { entityType: "web-application" } }),
    {
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any modern browser",
      isAccessibleForFree: false,
      offers: { "@type": "Offer", price: 10, priceCurrency: "USD" },
    },
  );

  assert.equal(application["@type"], "WebApplication");
  assert.equal(application.applicationCategory, "DeveloperApplication");
  assert.equal(application.operatingSystem, "Any modern browser");
  assert.equal(application.isAccessibleForFree, false);
  assert.deepEqual(application.offers, {
    "@type": "Offer",
    price: 10,
    priceCurrency: "USD",
  });
});

test("homepage collection is stable and explicitly unordered", () => {
  const collection = homepageCollectionSchema([
    makeTool({ entry: { slug: "zulu", name: "Zulu" } }),
    makeTool({ entry: { slug: "alpha", name: "Alpha" } }),
  ]);
  const list = collection.mainEntity;

  assert.equal(collection["@type"], "CollectionPage");
  assert.equal(list["@type"], "ItemList");
  assert.equal(list.itemListOrder, "https://schema.org/ItemListUnordered");
  assert.deepEqual(
    list.itemListElement.map((item) => new URL(item.url).pathname),
    ["/tools/alpha", "/tools/zulu"],
  );
  assert.ok(list.itemListElement.every((item) => item.position === undefined));
});

test("category collection exposes its authored metadata and visible ordered entries", () => {
  const category = {
    slug: "protocols",
    label: "Protocols",
    seoTitle: "Open protocols for AI agents",
    descriptionMd: "Evidence-reviewed **protocols** for agents.",
    definitionMd: "Standards for interoperable agent communication.",
    useCases: [],
    sources: [{
      title: "Protocol documentation",
      url: "https://example.com/protocol",
      claim: "Defines the protocol.",
    }],
    reviewedBy: "Editorial reviewer",
    reviewedAt: "2026-08-30T12:00:00.000Z",
    publishedAt: "2026-08-01T12:00:00.000Z",
    contentModifiedAt: "2026-08-30T12:00:00.000Z",
    isIndexable: true,
  };
  const collection = collectionPageSchema(
    category,
    [makeTool({ entry: { slug: "x402", name: "x402" } })],
    "/category/protocols",
  );

  assert.equal(collection["@type"], "CollectionPage");
  assert.equal(collection.name, "Open protocols for AI agents");
  assert.equal(collection.description, "Evidence-reviewed protocols for agents.");
  assert.equal(collection.lastReviewed, "2026-08-30");
  assert.equal(collection.mainEntity["@type"], "ItemList");
  assert.equal(collection.mainEntity.numberOfItems, 1);
  assert.equal(collection.mainEntity.itemListElement[0].position, 1);
  assert.equal(collection.mainEntity["@context"], undefined);
  assert.equal(collection.citation[0].url, "https://example.com/protocol");
});
