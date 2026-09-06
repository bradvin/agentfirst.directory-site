export interface CategoryEditorial {
  slug: string;
  label: string;
  seoTitle: string;
  description: string;
  definition: string;
  includeWhen: readonly string[];
  excludeWhen: readonly string[];
  selectionQuestions: readonly string[];
}

export const editorialPolicy = {
  version: "1.0",
  effectiveDate: "2026-09-03",
  effectiveDateLabel: "3 September 2026",
} as const;

export const categoryEditorialEntries = [
  {
    slug: "agent-identity-communication",
    label: "Identity & Comms",
    seoTitle: "AI agent identity and communication tools",
    description:
      "Tools that give agents a durable identity or a practical channel for email, messaging, phone calls, and other communications.",
    definition:
      "Identity and communication tools belong here when they are designed for agents to be addressed, authenticated, contacted, or represented in an ongoing workflow.",
    includeWhen: [
      "An agent can provision or operate its own inbox, number, account, or communication identity.",
      "Inbound and outbound communication is exposed through an agent-usable API, protocol, CLI, SDK, or tool interface.",
      "Identity, permissions, delivery, or event handling is a material part of the product.",
    ],
    excludeWhen: [
      "It is a conventional chat, CRM, or telecom product with only a generic API.",
      "The agent capability is only a thin integration or marketing label.",
    ],
    selectionQuestions: [
      "Which communication channels can an agent use?",
      "Does the agent receive a persistent address or identity?",
      "How are inbound events, authentication, and permissions handled?",
    ],
  },
  {
    slug: "agent-compute-sandbox-environments",
    label: "Compute & Sandboxes",
    seoTitle: "Compute and sandbox environments for AI agents",
    description:
      "Isolated computers, execution environments, and managed runtimes where agents can run code or operate software safely.",
    definition:
      "Compute tools belong here when they materially improve an agent’s ability to execute, inspect, resume, or contain code, command-line, desktop, or remote-machine work.",
    includeWhen: [
      "Agents can provision, control, or resume an isolated execution environment programmatically.",
      "The product provides meaningful containment, persistence, observability, or computer-use support.",
      "Agent execution is a documented first-class workflow rather than an incidental use of generic hosting.",
    ],
    excludeWhen: [
      "It is ordinary cloud hosting or container infrastructure with no substantive agent workflow.",
      "It only wraps a shell command without isolation, state, or control benefits.",
    ],
    selectionQuestions: [
      "What can the agent execute or control?",
      "What isolation and persistence boundaries are provided?",
      "Can a person inspect, stop, or resume the environment?",
    ],
  },
  {
    slug: "web-browser-interaction-tools",
    label: "Browser Automation",
    seoTitle: "Browser automation tools for AI agents",
    description:
      "Browser runtimes and control layers that let agents navigate websites, maintain sessions, and complete multi-step web tasks.",
    definition:
      "Browser automation tools belong here when their primary value is operating a browser or website interface for an agent, from low-level browser control to higher-level task execution.",
    includeWhen: [
      "The agent can navigate, click, type, inspect, or extract through a real or emulated browser.",
      "Session state, browser infrastructure, or agent-oriented control is a core capability.",
      "The workflow supports multi-step interaction rather than extraction alone.",
    ],
    excludeWhen: [
      "Its main purpose is crawling or structured extraction without browser interaction.",
      "It is a general browser-testing library with no material agent workflow.",
    ],
    selectionQuestions: [
      "Does it expose task-level automation, low-level browser control, or both?",
      "Can sessions and authenticated state persist across runs?",
      "What controls exist for observation, approval, and recovery?",
    ],
  },
  {
    slug: "agent-ui-frontends",
    label: "UI & Frontends",
    seoTitle: "User interfaces and frontends for AI agents",
    description:
      "Interfaces where agents present, generate, edit, or share work with people and other systems.",
    definition:
      "Frontend systems belong here when they are built around agent-generated interfaces, agent-user interaction, or shared human-agent work rather than conventional application UI alone.",
    includeWhen: [
      "Agents can create or materially edit the interface or its content.",
      "The interface exposes structured state, events, or collaboration designed for agent participation.",
      "Human-agent review or handoff is a documented core workflow.",
    ],
    excludeWhen: [
      "It is a general component library or frontend framework with no agent-specific capability.",
      "AI is limited to copy generation or a superficial chat widget.",
    ],
    selectionQuestions: [
      "What can the agent create, change, or observe in the interface?",
      "How is state shared between the person and the agent?",
      "Can agent-originated changes be reviewed or attributed?",
    ],
  },
  {
    slug: "web-crawling-data-extraction",
    label: "Crawling & Extraction",
    seoTitle: "Web crawling and data extraction tools for AI agents",
    description:
      "Services and libraries that turn web pages into reliable text or structured data for agent research and workflows.",
    definition:
      "Crawling and extraction tools belong here when their primary outcome is usable web data produced through crawling, page retrieval, parsing, or structured extraction.",
    includeWhen: [
      "The product returns clean text, structured records, or documented extraction output for agents.",
      "It materially handles crawling constraints such as rendering, pagination, change detection, or schema extraction.",
      "Agent or tool-calling workflows are documented as a first-class use case.",
    ],
    excludeWhen: [
      "The primary capability is interactive browser operation rather than retrieval or extraction.",
      "It is a generic HTTP client or scraper with no substantive agent-oriented capability.",
    ],
    selectionQuestions: [
      "What output formats and extraction guarantees are provided?",
      "How are JavaScript pages, pagination, and crawl failures handled?",
      "Can sources and retrieval times be preserved with the extracted data?",
    ],
  },
  {
    slug: "agent-testing-qa",
    label: "Agent Testing & QA",
    seoTitle: "Testing and QA tools for AI agents",
    description:
      "Tools that let agents plan, run, inspect, or maintain tests for software and agent-driven workflows.",
    definition:
      "Testing and quality-assurance systems belong here when agents actively author, operate, evaluate, or debug tests.",
    includeWhen: [
      "An agent can author, execute, adapt, or diagnose tests through a documented interface.",
      "The product preserves evidence such as steps, traces, screenshots, or reproducible results.",
      "Agent-driven QA is central to the product rather than a generic automation claim.",
    ],
    excludeWhen: [
      "It is a conventional test runner that an agent can merely invoke.",
      "It evaluates model output but provides no material agent or agent-builder workflow.",
    ],
    selectionQuestions: [
      "What can the agent author, execute, and repair?",
      "Which artifacts make a result reviewable?",
      "How are flaky tests, changed interfaces, and failed runs handled?",
    ],
  },
  {
    slug: "storage-media-hosting",
    label: "Storage & Media",
    seoTitle: "Storage and media hosting for AI agents",
    description:
      "Storage and delivery services that help agents persist, transform, retrieve, or share files and media.",
    definition:
      "Storage and media infrastructure belongs here when it has a documented agent-first workflow, such as direct tool access, durable artifact URLs, transformations, or agent-oriented discovery.",
    includeWhen: [
      "Agents can store, retrieve, transform, or share artifacts through a documented machine interface.",
      "Durability, permissions, provenance, or media processing materially improves the agent workflow.",
      "The product provides more than generic object storage with an API.",
    ],
    excludeWhen: [
      "It is conventional file hosting or object storage with no substantive agent workflow.",
      "The listing relies only on the fact that an agent could call its API.",
    ],
    selectionQuestions: [
      "Which artifact types and transformations are supported?",
      "How long do links and stored objects remain available?",
      "What access, privacy, and provenance controls exist?",
    ],
  },
  {
    slug: "long-term-memory-state-management",
    label: "Memory & State",
    seoTitle: "Long-term memory and state tools for AI agents",
    description:
      "Memory and state systems that help agents retain, retrieve, reason over, and update context across sessions.",
    definition:
      "Memory and state tools belong here when they provide durable layers for continuity in agent behaviour, including conversation, entity, user, episodic, and workflow state.",
    includeWhen: [
      "The system models memory or evolving state for agents rather than only storing documents.",
      "Retrieval, updates, or reasoning over past context is a documented core capability.",
      "The product addresses persistence across sessions, tasks, or agents.",
    ],
    excludeWhen: [
      "It is a generic database, cache, or vector store without an agent memory abstraction.",
      "It offers retrieval alone without maintaining meaningful agent state.",
    ],
    selectionQuestions: [
      "What types of memory or state are represented?",
      "How are memories created, retrieved, corrected, and deleted?",
      "Can users inspect provenance and control retention?",
    ],
  },
  {
    slug: "agent-payment-financial-primitives",
    label: "Payments",
    seoTitle: "Payment and financial infrastructure for AI agents",
    description:
      "Wallets, payment protocols, controls, and financial rails that let agents transact under explicit authority.",
    definition:
      "Payment infrastructure belongs here when it lets agents discover prices, hold or use payment credentials, transact, or operate within programmable financial controls.",
    includeWhen: [
      "An agent can initiate, receive, or negotiate a payment through a documented machine interface.",
      "Identity, delegated authority, spend controls, or settlement is a material capability.",
      "The product or protocol is designed for machine-to-machine or agent-mediated commerce.",
    ],
    excludeWhen: [
      "It is a consumer wallet, payment processor, or fintech API with no substantive agent role.",
      "The listing is supported only by a thin agent integration.",
    ],
    selectionQuestions: [
      "Who authorizes spending and how are limits enforced?",
      "Which assets, networks, or payment schemes are supported?",
      "What audit, identity, reversal, and recovery controls exist?",
    ],
  },
  {
    slug: "agent-frameworks-standards",
    label: "Frameworks & Standards",
    seoTitle: "Frameworks and standards for building AI agents",
    description:
      "Frameworks, SDKs, specifications, and interoperability standards used to define, build, or connect agents.",
    definition:
      "Frameworks and standards belong here when agents, agent runtimes, or agent interactions are their central subject.",
    includeWhen: [
      "The framework provides first-class agent abstractions, execution, tools, state, or coordination.",
      "The standard defines interoperable agent behavior, messages, interfaces, or packaging.",
      "Removing the agent concept would fundamentally change the framework or specification.",
    ],
    excludeWhen: [
      "It is a general AI, machine-learning, or application framework with no first-class agent model.",
      "It is an informal convention or thin wrapper without maintained documentation or specification.",
    ],
    selectionQuestions: [
      "Is this an implementation framework, an SDK, or an interoperability standard?",
      "Which agent concepts and extension points are defined?",
      "What implementations, versioning, and compatibility evidence exist?",
    ],
  },
  {
    slug: "saas-tool-integration-platforms",
    label: "SaaS Integrations",
    seoTitle: "SaaS integration platforms for AI agents",
    description:
      "Connector platforms that let agents authenticate with and take governed actions across third-party SaaS products.",
    definition:
      "Connector catalogues and integration platforms belong here when their primary value is giving agents usable actions across external business applications.",
    includeWhen: [
      "The platform exposes maintained connectors or action catalogs designed for agent tool use.",
      "Authentication, user authorization, and action execution are handled as substantive platform capabilities.",
      "The agent can discover or invoke integrations through a documented common interface.",
    ],
    excludeWhen: [
      "It offers only one product integration or a thin connector wrapper.",
      "It is a conventional automation platform with no material agent-first interaction model.",
    ],
    selectionQuestions: [
      "Which applications and actions are covered?",
      "How are user authorization and credential boundaries enforced?",
      "Can agents discover schemas, errors, and required approvals programmatically?",
    ],
  },
  {
    slug: "orchestrators",
    label: "Orchestrators",
    seoTitle: "Orchestration platforms for teams of AI agents",
    description:
      "Control planes and runtimes that coordinate agents, tasks, schedules, state, governance, and human review.",
    definition:
      "Orchestrators belong here when their main purpose is coordinating agent work across multiple runs, roles, workers, or workflows rather than implementing one agent in isolation.",
    includeWhen: [
      "The system assigns, schedules, routes, or supervises work across agents or agent runs.",
      "Shared state, observability, budgets, approvals, or governance is a material capability.",
      "Long-running or event-driven coordination is explicitly supported.",
    ],
    excludeWhen: [
      "It is a single-agent framework with no material coordination layer.",
      "It is a generic workflow scheduler that can only launch an agent as an ordinary job.",
    ],
    selectionQuestions: [
      "What unit of work is coordinated and how is ownership assigned?",
      "How are state, failures, budgets, and approvals managed?",
      "Which agent runtimes can participate?",
    ],
  },
  {
    slug: "api-access-orchestration-layers",
    label: "API Orchestration",
    seoTitle: "API access and orchestration layers for AI agents",
    description:
      "Layers that help agents discover, authenticate to, route, govern, and execute APIs or reusable tools.",
    definition:
      "API orchestration tools belong here when they sit between an agent and external APIs, and discovery, credentials, policy, routing, or execution materially improves safe tool use.",
    includeWhen: [
      "The product gives agents a documented way to discover and invoke APIs, tools, or skills.",
      "Credential protection, permissions, policy, or execution mediation is a core capability.",
      "It provides a reusable orchestration layer rather than one isolated integration.",
    ],
    excludeWhen: [
      "It is a conventional API gateway or client with no substantive agent workflow.",
      "Its agent support is limited to exposing an existing endpoint through a thin wrapper.",
    ],
    selectionQuestions: [
      "How are tools discovered and described to the agent?",
      "Where do credentials live and how is access constrained?",
      "What approval, logging, retry, and error-handling controls exist?",
    ],
  },
  {
    slug: "voice-multimodal-interfaces",
    label: "Voice & Multimodal",
    seoTitle: "Voice and multimodal interfaces for AI agents",
    description:
      "Platforms that let agents perceive, generate, or interact through voice, audio, images, video, and other modalities.",
    definition:
      "Voice and multimodal tools belong here when real-time speech or another non-text modality is central to the agent’s operation or user experience.",
    includeWhen: [
      "The product provides a documented runtime or interface for voice or multimodal agents.",
      "Real-time interaction, turn handling, telephony, media events, or modality coordination is substantive.",
      "Agents are active participants rather than simple media-generation callers.",
    ],
    excludeWhen: [
      "It is only a generic speech, image, or video model API.",
      "It adds voice or media to a conventional app without a material agent interaction model.",
    ],
    selectionQuestions: [
      "Which modalities and transport channels are supported?",
      "How are latency, interruptions, state, and handoffs handled?",
      "What recording, consent, and data-retention controls exist?",
    ],
  },
  {
    slug: "specialized-search-discovery-engines",
    label: "Search & Discovery",
    seoTitle: "Specialized search and discovery tools for AI agents",
    description:
      "Search, enrichment, and discovery systems that give agents structured access to specialized people, company, job, or domain data.",
    definition:
      "Search and discovery tools belong here when their indexed data, ranking, enrichment, or result structure materially improves an agent workflow.",
    includeWhen: [
      "The search corpus or enrichment is specialized and documented.",
      "Results are available in structured, agent-usable form with useful provenance or identifiers.",
      "The product materially improves discovery beyond a generic web search or API call.",
    ],
    excludeWhen: [
      "It is a broad consumer search engine with no substantive agent interface.",
      "Its main capability is crawling or extraction rather than search and discovery.",
    ],
    selectionQuestions: [
      "What corpus is searched and how current is it?",
      "Which fields, filters, identifiers, and provenance accompany results?",
      "What coverage, confidence, and data-use limitations are disclosed?",
    ],
  },
  {
    slug: "marketing-seo",
    label: "Marketing & SEO",
    seoTitle: "Marketing and SEO tools for AI agents",
    description:
      "Research, optimisation, and measurement tools that let agents perform accountable marketing and search-visibility work.",
    definition:
      "Marketing and SEO tools belong here when they are designed for agent workflows, including demand research, search analysis, content planning, optimisation, and measurable follow-up actions.",
    includeWhen: [
      "An agent can research, analyse, recommend, or execute a substantive marketing or SEO task through a documented interface.",
      "The product exposes useful source data, metrics, constraints, or outputs rather than only generating promotional copy.",
      "Agent use is a documented workflow with enough evidence for a person to review the result.",
    ],
    excludeWhen: [
      "It is a conventional marketing suite with only a generic API or superficial agent integration.",
      "Its primary value is undifferentiated AI copy generation without source data, measurement, or an agent-specific workflow.",
    ],
    selectionQuestions: [
      "Which marketing or search decision does the tool help an agent make?",
      "What source data, metrics, and provenance accompany the output?",
      "Which actions require human review and how can their effects be measured?",
    ],
  },
] as const satisfies readonly CategoryEditorial[];

export type CategoryEditorialSlug = (typeof categoryEditorialEntries)[number]["slug"];

const categoryEditorialBySlug = new Map<string, CategoryEditorial>(
  categoryEditorialEntries.map((entry) => [entry.slug, entry]),
);

export function getCategoryEditorial(slug: string) {
  return categoryEditorialBySlug.get(slug);
}
