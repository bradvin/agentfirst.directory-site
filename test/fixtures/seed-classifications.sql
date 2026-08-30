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
