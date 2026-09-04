DELETE FROM tools;
DELETE FROM categories;

INSERT INTO categories (slug, label, sort_order, source_path)
VALUES
  ('agent-infrastructure', 'Agent Infrastructure', 10, 'categories/agent-infrastructure.json'),
  ('protocols', 'Protocols', 20, 'categories/protocols.json');

INSERT INTO tools (
  slug, name, description, body_md, category_slug, tags_json,
  website_url, github_url, pricing, classification, sort_order,
  source_path, submitted_by_github
) VALUES
  (
    'hermes-agent', 'Hermes Agent', 'An autonomous agent runtime',
    '## So agents can...\n\nRun durable workflows.', 'agent-infrastructure',
    '["agents","runtime"]', 'https://hermes-agent.nousresearch.com',
    'https://github.com/NousResearch/hermes-agent', 'open-source', 'agent-native', 10,
    'tools/hermes-agent.md', 'foo-bender'
  ),
  (
    'fiber', 'Fiber', 'Live data APIs for AI sales agents',
    '## So agents can...\n\nUse live sales data.', 'agent-infrastructure',
    '["sales","data"]', 'https://fiber.ai', NULL, 'paid', 'agent-enabling', 20,
    'tools/fiber.md', 'foo-bender'
  ),
  (
    'legacy-tool', 'Legacy Tool', 'A staged legacy row without classification',
    'Legacy compatibility fixture.', 'agent-infrastructure', '["legacy"]',
    'https://example.com/legacy', NULL, 'free', NULL, 30,
    'tools/legacy-tool.md', 'foo-bender'
  ),
  (
    'x402', 'x402', 'An open protocol for internet-native payments',
    '## So agents can...\n\nPay for services.', 'protocols', '["payments","protocol"]',
    'https://www.x402.org', 'https://github.com/coinbase/x402', 'open-source',
    'agent-internet-protocol', 10, 'tools/x402.md', 'foo-bender'
  );

UPDATE categories
SET
  seo_title = 'AI agent infrastructure tools',
  description_md = 'Infrastructure for durable and observable AI agent workflows.',
  definition_md = 'Systems that provide a material runtime, data, or control capability for agents.',
  scope_md = 'This fixture category covers substantive infrastructure rather than generic API compatibility.',
  inclusion_md = '- Provides a first-class agent capability\n- Documents the agent-facing interface',
  exclusion_md = '- Generic infrastructure with no material agent workflow',
  selection_guide_md = '- Compare interfaces and deployment\n- Inspect evidence and limitations',
  use_cases_json = '["Run durable agent workflows","Connect agents to verified data"]',
  sources_json = '[{"title":"Agent infrastructure fixture source","url":"https://example.com/agent-infrastructure","claim":"Fixture evidence for the category definition and comparison guidance.","accessedAt":"2026-09-03","sourceType":"official-documentation"}]',
  published_at = '2026-08-01T00:00:00.000Z',
  content_modified_at = '2026-09-01T00:00:00.000Z'
WHERE slug = 'agent-infrastructure';

UPDATE categories
SET
  seo_title = 'AI agent payment protocol tools',
  description_md = 'Protocols that let AI agents discover and complete internet-native payments.',
  definition_md = 'Technical standards that define an agent-facing payment exchange.',
  scope_md = 'This fixture category covers payment protocols rather than general billing software.',
  inclusion_md = '- Defines a documented agent-facing payment flow\n- Publishes an implementable protocol',
  exclusion_md = '- General payment products without an agent protocol',
  selection_guide_md = '- Inspect protocol maturity\n- Compare supported networks and implementations',
  use_cases_json = '["Pay for agent-accessible services","Implement machine-to-machine payments"]',
  sources_json = '[{"title":"Protocol fixture specification","url":"https://www.x402.org","claim":"Fixture evidence for the protocol category definition.","accessedAt":"2026-09-03","sourceType":"official-specification"}]',
  published_at = '2026-08-01T00:00:00.000Z',
  content_modified_at = '2026-09-01T00:00:00.000Z'
WHERE slug = 'protocols';

UPDATE tools
SET
  entity_type = 'software-source-code',
  developer_name = 'Nous Research',
  docs_url = 'https://github.com/NousResearch/hermes-agent',
  interfaces_json = '["CLI"]',
  deployment_modes_json = '["self-hosted"]',
  evidence_json = '[{"title":"Hermes Agent documentation","url":"https://github.com/NousResearch/hermes-agent","claim":"The maintained repository documents an autonomous agent runtime and CLI.","accessedAt":"2026-09-03","sourceType":"official-repository"}]',
  verification_level = 'documentation-reviewed',
  classification_rationale_md = 'Agents are the runtime''s core actor rather than an incidental integration.',
  best_for_md = 'Self-hosted autonomous agent workflows.',
  limitations_md = 'No independent performance benchmark is asserted.',
  published_at = '2026-08-01T00:00:00.000Z',
  content_modified_at = '2026-09-02T00:00:00.000Z'
WHERE slug = 'hermes-agent';

UPDATE tools
SET
  entity_type = 'service',
  developer_name = 'Fiber',
  docs_url = 'https://fiber.ai',
  interfaces_json = '["API"]',
  deployment_modes_json = '["hosted service"]',
  evidence_json = '[{"title":"Fiber product documentation","url":"https://fiber.ai","claim":"The product site documents live data APIs for AI sales agents.","accessedAt":"2026-09-03","sourceType":"official-product-page"}]',
  verification_level = 'documentation-reviewed',
  classification_rationale_md = 'Fiber exposes data infrastructure intended for agent workflows.',
  best_for_md = 'AI sales agents that need current business data.',
  limitations_md = 'The fixture does not assert independent coverage or accuracy benchmarks.',
  content_modified_at = '2026-09-02T00:00:00.000Z'
WHERE slug = 'fiber';

UPDATE tools
SET
  developer_name = 'Fixture Publisher',
  docs_url = 'https://example.com/legacy',
  interfaces_json = '["web"]',
  deployment_modes_json = '["hosted service"]',
  evidence_json = '[{"title":"Legacy Tool product page","url":"https://example.com/legacy","claim":"The fixture page is the primary product reference for this staged record.","accessedAt":"2026-09-03","sourceType":"official-product-page"}]',
  verification_level = 'documentation-reviewed',
  classification_rationale_md = 'The fixture retains a deliberately unclassified record while documenting its inclusion.',
  best_for_md = 'Testing compatibility with staged records that predate classification.',
  limitations_md = 'This is a test fixture and does not represent a production recommendation.',
  content_modified_at = '2026-09-02T00:00:00.000Z'
WHERE slug = 'legacy-tool';

UPDATE tools
SET
  entity_type = 'protocol',
  developer_name = 'Coinbase',
  docs_url = 'https://www.x402.org',
  license_url = 'https://github.com/coinbase/x402',
  interfaces_json = '["HTTP"]',
  deployment_modes_json = '["protocol implementation"]',
  evidence_json = '[{"title":"x402 specification","url":"https://www.x402.org","claim":"The official site documents an open protocol for internet-native payments.","accessedAt":"2026-09-03","sourceType":"official-specification"}]',
  verification_level = 'documentation-reviewed',
  classification_rationale_md = 'x402 standardizes an internet payment exchange that agents can implement.',
  best_for_md = 'Machine-to-machine payments over an open HTTP-oriented protocol.',
  limitations_md = 'The fixture does not assert network adoption or production reliability.',
  content_modified_at = '2026-09-02T00:00:00.000Z'
WHERE slug = 'x402';

DELETE FROM url_redirects;

INSERT INTO url_redirects (source_path, destination_path, status_code, note)
VALUES
  ('/old-hermes', '/tools/hermes-agent', 301, 'Rendered redirect fixture'),
  ('/retired-directory-page', NULL, 410, 'Rendered gone-page fixture');
