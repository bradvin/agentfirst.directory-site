import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const classificationMigrationPath = new URL("../migrations/0003_add_tool_classification.sql", import.meta.url);
const editorialSeoMigrationPath = new URL("../migrations/0004_add_editorial_seo_metadata.sql", import.meta.url);
const migrationPaths = [
  new URL("../migrations/0001_initial.sql", import.meta.url),
  new URL("../migrations/0002_add_tool_submitter.sql", import.meta.url),
];

function createPreClassificationDatabase({ populated = false } = {}) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");

  for (const path of migrationPaths) {
    database.exec(readFileSync(path, "utf8"));
  }

  if (populated) {
    database.exec(`
      INSERT INTO categories (slug, label, source_path)
      VALUES ('protocols', 'Protocols', 'categories/protocols.json');

      INSERT INTO tools (
        slug, name, description, body_md, category_slug, tags_json,
        website_url, pricing, source_path, submitted_by_github
      ) VALUES (
        'x402', 'x402', 'Agent payment protocol', 'Protocol details',
        'protocols', '["payments"]', 'https://www.x402.org', 'open-source',
        'tools/x402.md', 'foo-bender'
      );
    `);
  }

  return database;
}

function applyClassificationMigration(database) {
  database.exec(readFileSync(classificationMigrationPath, "utf8"));
}

function applyEditorialSeoMigration(database) {
  database.exec(readFileSync(editorialSeoMigrationPath, "utf8"));
}

function createPreEditorialSeoDatabase({ populated = false } = {}) {
  const database = createPreClassificationDatabase({ populated });
  applyClassificationMigration(database);
  return database;
}

test("migration upgrades a populated tools table without fabricating a classification", () => {
  const database = createPreClassificationDatabase({ populated: true });

  applyClassificationMigration(database);

  const row = database.prepare("SELECT slug, classification FROM tools WHERE slug = ?").get("x402");
  assert.equal(row.slug, "x402");
  assert.equal(row.classification, null);
});

test("migration accepts every classification value", () => {
  const database = createPreClassificationDatabase({ populated: true });
  applyClassificationMigration(database);

  for (const classification of [
    "agent-native",
    "agent-enabling",
    "agent-internet-protocol",
  ]) {
    database.prepare("UPDATE tools SET classification = ? WHERE slug = 'x402'").run(classification);
    assert.equal(
      database.prepare("SELECT classification FROM tools WHERE slug = 'x402'").get().classification,
      classification,
    );
  }
});

test("migration rejects an invalid classification", () => {
  const database = createPreClassificationDatabase({ populated: true });
  applyClassificationMigration(database);

  assert.throws(
    () => database.prepare("UPDATE tools SET classification = 'agent-compatible' WHERE slug = 'x402'").run(),
    /CHECK constraint failed/,
  );
});

test("migration permits NULL during the staged rollout", () => {
  const database = createPreClassificationDatabase({ populated: true });
  applyClassificationMigration(database);

  assert.doesNotThrow(() =>
    database.prepare("UPDATE tools SET classification = NULL WHERE slug = 'x402'").run(),
  );
  assert.equal(
    database.prepare("SELECT classification FROM tools WHERE slug = 'x402'").get().classification,
    null,
  );
});

test("editorial SEO migration upgrades populated rows with safe defaults", () => {
  const database = createPreEditorialSeoDatabase({ populated: true });

  applyEditorialSeoMigration(database);

  const tool = database.prepare(`
    SELECT slug, interfaces_json, deployment_modes_json, evidence_json,
           entity_type, verification_level, is_indexable
    FROM tools
    WHERE slug = 'x402'
  `).get();
  const category = database.prepare(`
    SELECT slug, use_cases_json, sources_json, is_indexable
    FROM categories
    WHERE slug = 'protocols'
  `).get();

  assert.deepEqual({ ...tool }, {
    slug: "x402",
    interfaces_json: "[]",
    deployment_modes_json: "[]",
    evidence_json: "[]",
    entity_type: null,
    verification_level: null,
    is_indexable: 1,
  });
  assert.deepEqual({ ...category }, {
    slug: "protocols",
    use_cases_json: "[]",
    sources_json: "[]",
    is_indexable: 1,
  });
});

test("editorial SEO migration constrains entity and verification vocabularies", () => {
  const database = createPreEditorialSeoDatabase({ populated: true });
  applyEditorialSeoMigration(database);

  for (const entityType of [
    "software-application",
    "web-application",
    "software-source-code",
    "web-api",
    "service",
    "technical-standard",
    "protocol",
  ]) {
    database.prepare("UPDATE tools SET entity_type = ? WHERE slug = 'x402'").run(entityType);
    assert.equal(
      database.prepare("SELECT entity_type FROM tools WHERE slug = 'x402'").get().entity_type,
      entityType,
    );
  }

  assert.throws(
    () => database.prepare("UPDATE tools SET entity_type = 'thing' WHERE slug = 'x402'").run(),
    /CHECK constraint failed/,
  );

  for (const verificationLevel of [
    "documentation-reviewed",
    "vendor-confirmed",
    "hands-on-tested",
  ]) {
    database.prepare("UPDATE tools SET verification_level = ? WHERE slug = 'x402'").run(verificationLevel);
    assert.equal(
      database.prepare("SELECT verification_level FROM tools WHERE slug = 'x402'").get().verification_level,
      verificationLevel,
    );
  }

  assert.throws(
    () => database.prepare("UPDATE tools SET verification_level = 'unverified' WHERE slug = 'x402'").run(),
    /CHECK constraint failed/,
  );
});

test("editorial SEO migration rejects invalid dimensions and indexability flags", () => {
  const database = createPreEditorialSeoDatabase({ populated: true });
  applyEditorialSeoMigration(database);

  assert.doesNotThrow(() =>
    database.prepare(`
      UPDATE tools
      SET logo_width = 96, logo_height = 96, og_image_width = 1200, og_image_height = 630
      WHERE slug = 'x402'
    `).run(),
  );
  for (const column of ["logo_width", "logo_height", "og_image_width", "og_image_height"]) {
    assert.throws(
      () => database.prepare(`UPDATE tools SET ${column} = 0 WHERE slug = 'x402'`).run(),
      /CHECK constraint failed/,
      column,
    );
  }

  assert.throws(
    () => database.prepare("UPDATE tools SET is_indexable = 2 WHERE slug = 'x402'").run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.prepare("UPDATE categories SET is_indexable = -1 WHERE slug = 'protocols'").run(),
    /CHECK constraint failed/,
  );
});

test("redirect table permits only internal redirect statuses with coherent destinations", () => {
  const database = createPreEditorialSeoDatabase();
  applyEditorialSeoMigration(database);

  assert.doesNotThrow(() => database.exec(`
    INSERT INTO url_redirects (source_path, destination_path, status_code)
    VALUES
      ('/old-tool', '/tools/new-tool', 301),
      ('/old-category', '/category/new-category', 308),
      ('/retired-tool', NULL, 410);
  `));
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM url_redirects").get().count, 3);

  const invalidRows = [
    "('/gone-with-target', '/somewhere', 410)",
    "('/redirect-without-target', NULL, 301)",
    "('/temporary', '/somewhere', 302)",
  ];
  for (const values of invalidRows) {
    assert.throws(
      () => database.exec(`
        INSERT INTO url_redirects (source_path, destination_path, status_code)
        VALUES ${values};
      `),
      /CHECK constraint failed/,
      values,
    );
  }

  assert.throws(
    () => database.exec(`
      INSERT INTO url_redirects (source_path, destination_path, status_code, is_active)
      VALUES ('/bad-active', '/target', 301, 2);
    `),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO url_redirects (source_path, destination_path, status_code)
      VALUES ('/old-tool', '/another-target', 301);
    `),
    /UNIQUE constraint failed/,
  );
});
