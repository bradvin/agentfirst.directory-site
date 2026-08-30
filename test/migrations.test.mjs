import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationPath = new URL("../migrations/0003_add_tool_classification.sql", import.meta.url);
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
  database.exec(readFileSync(migrationPath, "utf8"));
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
