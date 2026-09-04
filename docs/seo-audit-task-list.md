# SEO and AI Citation Audit — Working Task List

Last updated: 2026-09-04

This document turns the 2026-09-03 full-site SEO audit into an implementation and verification checklist. It is intentionally kept in the repository so code changes, content work, deployment configuration, and post-launch measurement stay connected.

## Status key

- [ ] Not started
- [~] In progress
- [x] Implemented and locally verified
- [!] Requires production access, editorial input, or ongoing operations

## Baseline captured during the audit

- 53 sitemap URLs: 35 tools, 15 categories, and 3 static pages.
- All sitemap URLs returned `200`, an exact HTTPS self-canonical, one H1, unique title and description, and parseable JSON-LD.
- No broken internal links were found in the sitemap crawl.
- Pages are server-rendered and retain their core content without client JavaScript.
- The automated test suite passed 17/17 and the production build completed.
- The primary citation-readiness constraint is thin, vendor-style copy with little visible evidence, authorship, review provenance, or original research.
- The first implementation corpus advanced to 37 tools and 16 categories before the initial production rollout.
- A production recheck during implementation found an additional live `agentseo` row that was absent from that 37-tool source. Upstream PR #50 subsequently added AgentSEO intentionally; its profile was reconciled with the citation-ready schema before the audit changes were merged.
- The final source-of-truth contains 38 published tools, 16 active categories, and one legacy redirect. Two currently empty categories are correctly omitted from navigation and sitemaps, producing 60 indexable sitemap pages: 38 tools, 14 populated categories, and 8 editorial/static pages.
- The final evidence corpus contains 149 tool-level claim sources and 17 category-level sources. Every published tool and every active category has at least one source.
- Production exports and sitemaps now match the source-of-truth corpus: 38 published tools, 16 active categories, and one active redirect, with zero invalid published tools at validation time.

## Production performance baseline

- Chrome DevTools lab trace on 2026-09-03: 164 ms TTFB, 313 ms LCP, and 0.019 CLS; no CrUX field data was available for the page.
- Mobile Lighthouse: 100 Accessibility, 100 Best Practices, 100 SEO, and 100 Agentic Browsing.
- The only quantified render-blocking opportunity was the site stylesheet plus Google Fonts CSS at an estimated 60 ms FCP/LCP saving.
- The observed layout shift came from downloaded IBM Plex fonts, but remained well within the good CLS threshold; the trace estimated no saving from changing the current network dependency chain.
- The production stylesheet was revalidated with `max-age=0`; the new immutable `/_astro/*` rule addresses this after deployment.

## 1. Canonical origin and indexation controls

- [x] Permanently redirect HTTP requests to `https://agentfirst.directory` in Worker middleware.
- [x] Disable the public `workers.dev` origin and preview URLs in production configuration.
- [x] Redirect unexpected production hostnames to the canonical host in Worker middleware.
- [x] Configure HSTS and the associated security headers; verify them again after deployment.
- [x] Add `noindex, follow` to dynamic tool/category 404 responses.
- [x] Keep hard `404` status codes for missing records.
- [x] Add a persistent D1-backed legacy-slug redirect mechanism for renamed tool and category URLs.
- [x] Support explicit `410 Gone` responses for deliberately retired URLs with no replacement.
- [x] Add zone-level Always Use HTTPS and `www` → apex rules so static assets bypassed by Astro middleware receive the same canonical treatment; apex HTTP and both HTTP/HTTPS `www` requests now redirect permanently while retaining path and query string.

## 2. Sitemap, feeds, and discovery endpoints

- [x] Use pipeline-managed content-modification dates instead of sync timestamps in sitemaps, preserving the timestamp on no-op syncs.
- [x] Keep separate first-published, content-modified, last-reviewed, and operational sync dates without synthesizing unknown review dates.
- [x] Make sitemap eligibility use the same validation rules as page rendering.
- [x] Exclude empty/noindex categories from the category sitemap.
- [x] Add a human- and machine-readable RSS feed for recently added or updated entries.
- [x] Add a stable JSON data endpoint for published directory entries.
- [x] Add an optional `llms.txt` discovery map without treating it as an indexing requirement.
- [x] Add an expanded AI-readable directory document and documented JSON/CSV endpoints.
- [!] Submit the sitemap in Google Search Console and Bing Webmaster Tools after deployment.
- [x] Configure non-blocking IndexNow notifications for changed canonical HTML URLs, with a public key file and automated payload tests.
- [x] Split the expanded D1 content sync into sub-80 KB ordered batches; the final 380,014-byte, 38-tool corpus renders as five complete-statement batches between 73,143 and 79,783 bytes.

## 3. Evidence, review, and editorial trust

- [x] Extend the D1 schema and TypeScript model with evidence and review metadata.
- [x] Store official documentation, pricing, repository, licence, and developer URLs separately.
- [x] Store claim-level evidence sources with source title, URL, narrowly supported claim, source type, and access date for all 38 current tools.
- [x] Store and visibly label verification level; all current profiles are truthfully marked documentation-reviewed, with no fabricated vendor confirmation or hands-on testing.
- [x] Store reviewer, first-published, content-modified, and last-reviewed fields; pipeline-managed modification dates are active and unverifiable human review/publication dates remain blank.
- [x] Store interfaces and deployment modes as normalized data.
- [x] Store qualification rationale, best-fit guidance, limitations, and unresolved/unknown facts for every current tool profile.
- [x] Render visible facts, qualification, best-fit, limitations, and sources sections.
- [x] Visually distinguish submitted/public-product summaries from claim-level documentation-reviewed facts.
- [x] Add an About page identifying the publisher and editorial responsibility.
- [x] Link the publisher's GitHub and X profiles visibly on the About page and in the publisher `Person.sameAs` graph.
- [x] Add a versioned Editorial Standards and Review Methodology page.
- [x] Document corrections, appeals, stale-entry review, and removal policies.
- [x] Document conflicts of interest, sponsorships, affiliate links, vendor submissions, and ordering.
- [x] Add globally visible links to the trust and methodology pages.
- [x] Expand the definition of “agent-first” with examples, counterexamples, authorship, and policy version history.

## 4. Category quality and topical architecture

- [x] Add authored SEO title, description, definition, scope, inclusion rules, and selection guidance for all 16 current categories.
- [x] Add 2–4 category-specific use cases and 17 claim-level primary sources across all 16 current categories.
- [!] Add last-reviewed dates only when a named human editorial review actually occurs; do not convert source-access or sync dates into review provenance.
- [x] Add useful normalized comparison tables to category pages, showing unknown values rather than guessing.
- [x] Mark empty categories `noindex` and omit them from navigation/sitemaps.
- [!] Consolidate or substantively enrich one-tool categories after editorial review; this cannot be automated without changing search intent.
- [!] Correct any mixed-intent categories through reviewed redirects before changing established URLs.
- [x] Create distinct editorial hubs for inclusion policy, review methodology, corrections, and directory research.
- [x] Avoid automatically generating thin tag archives or pairwise comparison pages.
- [x] Improve related-tool selection using shared category, verified interfaces, tags, and classification rather than insertion order.
- [x] Keep category listing, editorial guidance, evidence, and comparison sections in a shared responsive stack with consistent vertical spacing.

## 5. On-page SEO and social metadata

- [x] Rewrite tool titles to combine product name with category intent while staying compact.
- [x] Expand and length-bound meta descriptions with a factual reason to visit the profile.
- [x] Make the homepage title lead with the familiar “AI agent tools directory” query.
- [x] Give category titles explicit AI-agent search intent.
- [x] Make tool-card heading levels contextual so category cards sit below the section heading.
- [x] Provide tool-specific Open Graph image alt text.
- [x] Add Open Graph image dimensions and MIME type when the served format is known.
- [x] Add favicon, web manifest, and Apple touch icon coverage.
- [x] Correct low-contrast small labels and metadata text.
- [x] Preserve semantic whitespace around inline prose links on editorial pages and enforce it with rendered regression checks.

## 6. Structured data

- [x] Replace the one-size-fits-all application schema with explicit entity types and conservative protocol/source-code/service fallbacks.
- [x] Add a consistent `WebSite`, named publisher, `WebPage`, and breadcrumb graph.
- [x] Use supported application categories only where an entry is genuinely an application.
- [x] Stop inferring “free” from a coarse pricing label.
- [x] Add offers, reviews, ratings, and dates only when real and visibly supported.
- [x] Keep schema content consistent with visible page content.
- [x] Stabilize homepage structured-data ordering and remove rank-like positions.
- [x] Safely serialize JSON-LD so user-contributed text cannot terminate the script element.
- [!] Add Dataset schema only when a genuinely immutable, versioned research release and its reuse terms are published.

## 7. Performance and caching

- [x] Make HTML caching intentional with a Cloudflare Cache API allowlist and privacy bypasses.
- [x] Keep homepage shuffling non-personal, share each variant only for a short TTL, and emit deterministic unranked structured data.
- [x] Give fingerprinted `/_astro/*` assets long-lived immutable cache headers.
- [x] Stop lazy-loading the above-the-fold tool hero and give it high fetch priority.
- [x] Add explicit image dimensions and responsive source hints.
- [x] Proxy remote images through a controlled Cloudflare optimization path.
- [x] Add a 350 KB transformed-image budget, bounded buffering, and graceful local fallback.
- [x] Route oversized remote hero images through generated 1200×630 and 640×336 variants.
- [x] Trace cold font loading: current 0.019 CLS is already good and DevTools estimated no network-chain saving, so self-hosting/subsetting is not prioritized.
- [x] Keep Giscus deferred; do not prioritize it unless field data identifies a problem.

## 8. AI discovery and citation readiness

- [x] Keep OAI-SearchBot and user-triggered fetchers allowed for public pages.
- [x] Document the independent, currently permissive policy decision for training crawlers such as GPTBot.
- [x] Verify representative citation/search and user-triggered crawler access through Cloudflare; OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Googlebot, and bingbot all receive the repository-owned `robots.txt` with no challenge response. Continue reviewing verified-bot traffic by published IP ranges in Security Events as an operational control.
- [x] Expose concise claim-level facts, source access dates, qualification, fit, limitations, and unknowns in visible HTML and JSON/CSV/text exports.
- [x] Create stable section anchors for facts, overview, qualification, limitations, methodology, and sources.
- [!] Publish an immutable, versioned CSV/JSON dataset after Brad selects explicit bulk-reuse terms; live JSON and CSV exports are implemented now without inventing a licence.
- [x] Establish a reproducible live “State of Agent-First Infrastructure” research report using actual content dates and directory counts.
- [!] Add release-over-release changes, removals, and reclassifications when the first immutable, explicitly licensed snapshot is cut.
- [!] Earn relevant links by inviting listed vendors to reference verified profiles and by pitching original research to ecosystem publications.

## 9. Automated quality gates

- [x] Add metadata, canonical, robots, heading, social metadata, and JSON-LD regression tests.
- [x] Add sitemap/page eligibility consistency tests.
- [x] Add tests for redirects, aliases, 404 `noindex`, and retired URLs.
- [x] Add tests for evidence rendering, source-date visibility, complete real-content citation profiles, and safe JSON-LD serialization.
- [x] Add a full sitemap-page and internal-link rendered crawl to CI.
- [x] Enforce positive image dimensions when supplied and hard output dimensions/350 KB budgets on the controlled media route.
- [x] Run the repository `ci` script after implementation from a clean dependency install: 51/51 unit tests, zero Astro diagnostics, and a successful production build.
- [x] Run both repositories' GitHub Actions validation workflows locally with Local CI after the final code pass; the site and content workflows passed from clean isolated checkouts.
- [x] Re-crawl production after deployment and the final content merge; all 60 sitemap pages and 62 unique internal links passed status, canonical, metadata, H1, JSON-LD, evidence, and internal-link checks.

## 10. Measurement after launch

- [!] Verify Google Search Console ownership, sitemap ingestion, coverage, and manual-action status.
- [!] Verify Bing Webmaster Tools and Bing AI Performance reporting.
- [x] Record IndexNow delivery: 54 launch URLs were accepted with HTTP `202`, followed by 58 post-merge URLs with HTTP `200`; ongoing delivery/error monitoring remains part of routine operations.
- [!] Monitor verified search and AI crawler logs.
- [!] Maintain a fixed monthly benchmark set of citation-oriented queries.
- [!] Track citations, cited URLs, grounding queries, AI/search referrals, and conversions.
- [!] Run a backlink audit and monitor links to profiles, research, and datasets.

## Cloudflare production handoff

The failing 2026-09-03 baseline was remediated and rechecked on 2026-09-04. The replacement token can read the production D1 database, Worker deployments, DNS, zone settings, and redirect rules and can deploy the Worker. It does not currently include Cache Purge or Bot Management configuration-read permission; neither omission blocked the verified rollout.

- [x] In **SSL/TLS > Edge Certificates**, enable **Always Use HTTPS**. Apex HTTP and an HTTP static asset now receive permanent HTTPS redirects.
- [x] In **DNS > Records**, add a redirect-only record: type `A`, name `www`, IPv4 address `192.0.2.0`, proxy status **Proxied** (orange cloud), TTL **Auto**. `www` now resolves through Cloudflare without being attached as a Worker custom domain.
- [x] In **Rules > Redirect Rules > Single Redirects**, create `Canonical www to apex`: match hostname `www.agentfirst.directory`, dynamically redirect to `concat("https://agentfirst.directory", http.request.uri.path)`, use status `301`, and preserve the query string. HTTP and HTTPS tests retain the exact path and query string.
- [x] In **AI Crawl Control > Crawlers**, allow citation/search and user-triggered agents. Representative OpenAI, Perplexity, Anthropic, Google, and Bing user agents now reach discovery endpoints without a Cloudflare challenge.
- [x] In **AI Crawl Control > Directives/Settings**, keep Cloudflare from replacing the repository-owned `robots.txt`; the live response is the checked-in explicit crawler policy.
- [x] In **Security > Settings > Bot traffic**, keep **Block AI bots** off and **Verified bots** allowed. Live representative crawler probes return `200` without `cf-mitigated`; exact Bot Management configuration cannot be read with the current API token.
- [!] Review **Security > Events** and **AI Crawl Control > Metrics** for successful crawler requests to `/robots.txt`, `/sitemap-index.xml`, `/llms.txt`, `/llms-full.txt`, `/data/tools.json`, and representative tool/category pages after deployment.
- [x] Re-test `http://agentfirst.directory/`, `https://www.agentfirst.directory/test-path?source=seo`, and the HTTP `www` variant. All return `301` to the expected HTTPS apex URL with path and query string retained.
- [x] Expand the Codex Cloudflare API token sufficiently for production D1 backup/migration/sync, Worker deployment, and zone/DNS/rule verification. Cache Purge and Bot Management configuration-read permissions remain optional gaps.

## Progress log

- 2026-09-03: Baseline technical, content, schema, performance, and AI-citation audit completed.
- 2026-09-03: Implementation started; canonical-origin and deployment configuration work is in progress.
- 2026-09-03: Canonical redirects, indexation controls, D1 redirect/retirement support, security headers, cache policy, and asset cache rules implemented; production zone verification remains.
- 2026-09-03: Added About, Editorial Standards, Corrections, expanded Policy, category guidance, and live research pages with connected structured data.
- 2026-09-03: Added RSS, JSON, CSV, `llms.txt`, and `llms-full.txt`; added controlled media variants, icons, manifest, and explicit crawler policy.
- 2026-09-03: Corrected research freshness to use source-content dates and clarified the difference between verification links and claim-level reviewed evidence.
- 2026-09-03: Completed the content publisher migration, IndexNow integration, existing-profile evidence research, and expanded SEO regression tests.
- 2026-09-03: Captured a Chrome DevTools production trace and mobile Lighthouse baseline; performance and all four non-performance Lighthouse categories are already healthy, so implementation remains focused on caching, media delivery, evidence, and crawl consistency.
- 2026-09-03: Completed documentation-reviewed evidence profiles for all 37 tools (145 claim-level sources) and all 16 categories (17 category sources), without inventing reviewers or hands-on testing.
- 2026-09-03: Added a full rendered SEO crawl; the real corpus passed for 59 sitemap pages and 61 unique internal links with unique metadata, exact canonicals, one H1, parseable JSON-LD, visible evidence, and no broken internal targets.
- 2026-09-03: Expanded JSON, CSV, and `llms-full.txt` outputs to carry qualification rationale, best-fit guidance, limitations, unknowns, source access dates, and content provenance.
- 2026-09-03: The real-corpus D1 dry run exposed Cloudflare's 100,000-byte SQL statement ceiling. Deterministic complete-statement batching is now part of the publisher; five generated batches imported all 37 tools, 16 categories, 145 tool sources, 17 category sources, and one redirect successfully.
- 2026-09-03: Corrected pricing, categorization, identity, licence, and evidence details discovered during the final editorial audit; renamed Agent CI to Local CI with a permanent `301` legacy URL manifest.
- 2026-09-03: Upgraded Astro, the Cloudflare adapter, Wrangler, and Markdown-It; regenerated a cross-platform lockfile, confirmed zero npm audit vulnerabilities, and made Cloudflare type generation part of clean-checkout validation.
- 2026-09-03: Final production-sized rendered crawl passed for 59 sitemap pages and 61 unique internal targets. The separate citation-complete workflow fixture passed metadata, schema, feeds, exports, search, randomized-homepage, cache, redirect, `404`, `410`, and crawl assertions for 14 pages and 16 targets.
- 2026-09-03: At this checkpoint, local implementation was complete but production database sync, Worker deployment, and DNS/zone changes had not yet been performed. Those rollout items were completed on 2026-09-04; Search Console, Bing, and external outreach remain separate human/ongoing tasks.
- 2026-09-03: Closed the final isolated-runner failure by making content-pipeline Git operations select their target repositories explicitly. The content repository's full 71-test validation workflow and the site repository's build/render workflow both pass under Local CI.
- 2026-09-03: Verified partial Cloudflare access. D1 is readable, but the token cannot access Worker deployments or zone settings. A production probe confirmed plain HTTP still returns `200` and the `www` hostname does not resolve; exact Dashboard actions were added above for Brad.
- 2026-09-04: Switched the `www` handoff to Cloudflare's redirect-only DNS pattern after the Dashboard could not add it as a Worker custom domain. Removed `www` from the Worker custom-domain configuration to prevent a future deployment conflict; the apex remains the sole Worker custom domain.
- 2026-09-04: Verified Always Use HTTPS, proxied `www` DNS, and the `www` → apex redirect in production. HTTP and `www` requests now receive one permanent redirect to the exact canonical HTTPS path with the query string retained.
- 2026-09-04: Exported the production D1 database before mutation to `/tmp/agentfirst-seo-backup-20260904/pre-seo-sync.sql` (SHA-256 `aa88070a29beb456c4e30516f88c29c585792061a2146e8b4d678738e739472b`), applied migration `0004`, and imported all five deterministic source-of-truth batches. Post-sync integrity is 37 published tools, 16 active categories, 10 retired tools, one active redirect, and zero invalid published tools.
- 2026-09-04: Deployed the SEO implementation to the apex Worker and verified its D1 binding against the original production database. The first isolated deploy mistakenly auto-provisioned and briefly bound an empty database because a temporary shell variable was not exported; the binding was corrected immediately, the exact empty unintended database was inspected, and it was deleted.
- 2026-09-04: Removed an ignored macOS `.DS_Store` file that the first isolated artifact had copied into public assets, redeployed, and verified that `/.DS_Store` returns `404`.
- 2026-09-04: Completed the final live rollout crawl: all 59 sitemap pages and 61 unique internal links passed. Verified the homepage, discovery files, JSON/CSV exports, redirect, `404`, and representative crawler access; 54 changed canonical URLs were accepted by IndexNow with HTTP `202`.
- 2026-09-04: A targeted Cloudflare cache purge was unavailable because the token lacks Cache Purge permission. This did not block rollout: HTML uses a five-minute TTL, query-bypassed live probes were correct, and the complete post-deploy production crawl passed.
- 2026-09-04: Rebased the content work over upstream AgentSEO PR #50, added four reviewed official AgentSEO sources and the complete editorial metadata contract, and revalidated the expanded 38-tool corpus with all 71 tests passing.
- 2026-09-04: Merged the content implementation through protected-branch PR #54. The first publish run synced D1 but failed its post-sync cache purge because the token lacks Cache Purge permission; follow-up PR #55 made both purge and IndexNow best-effort so discovery delivery cannot be skipped by an optional cache operation.
- 2026-09-04: The corrected Publish D1 workflow completed on `main`: five batches synced 38 tools and 16 categories, the cache-purge permission error was contained as a warning, and IndexNow accepted 58 URLs with HTTP `200`.
- 2026-09-04: Added cache-bypassing headers to the production crawl so rollout verification cannot compare stale and fresh discovery endpoints. The final live crawl passed for 60 sitemap pages and 62 unique internal links, including the newly published AgentSEO profile.
- 2026-09-04: Merged the site implementation through protected-branch PR #5 after its required validation check passed. The first post-merge deploy uploaded the Worker but failed while reading zone routes because GitHub Actions still held the older Cloudflare token.
- 2026-09-04: Securely replaced `CLOUDFLARE_API_TOKEN` in both GitHub repositories from the 1Password AgentFirst Production environment without writing the value to either checkout. The failed site workflow was rerun successfully: validation, build, migration, and Worker deployment all passed on `main`.
- 2026-09-04: Completed the post-merge production closeout. The live crawl again passed 60 sitemap pages and 62 unique internal links; apex HTTP and HTTPS `www` still redirect permanently to the canonical apex URL, and `/.DS_Store` returns `404`.
- 2026-09-04: Corrected Astro's line-break whitespace trimming around inline links on the homepage, About, Corrections, Editorial Standards, open-source hub, and research pages. Added rendered assertions that reject anchors collapsed against surrounding prose; all local build and rendered-site checks pass.
- 2026-09-04: Added Brad Vincent's `https://x.com/bradvin` profile immediately after the GitHub publisher profile on the About page and included both identities in the publisher `Person.sameAs` structured data, with rendered and schema regression coverage.
- 2026-09-04: Fixed category-page section collisions by grouping the listing, guidance, evidence, and comparison blocks in a shared responsive stack. Browser measurements on Marketing & SEO showed all three section boundaries moving from `0px` to the intended `24px` gap; source-gate coverage now protects the layout rule.
