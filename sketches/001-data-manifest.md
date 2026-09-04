# Data manifest for homepage layout sketches

## Source

- Live source: `https://agentfirst.directory/api/tools.json`
- Captured for the site review on 2026-09-04.
- Captured evidence: `/home/brad/reports/agentfirst-directory-review/2026-09-04/raw/api-tools.json`
- Records inspected: 38.
- The sketches intentionally render the same six real records in every variant. Labels such as `6 sample listings` and the filter counts refer to the sample, while `38 evidence-reviewed listings` is the live directory total at capture time.

## Visible field mapping

- Tool name: `tools[].name` — Reliable, 38/38 populated.
- Tool URL: `tools[].url` or `tools[].slug` — Reliable, 38/38 slugs populated.
- One-line description: `tools[].description` — Reliable, 38/38 populated.
- Category label: `tools[].category.label` — Reliable, 38/38 populated.
- Category filter value: `tools[].category.label` — Reliable, 38/38 populated.
- Classification badge: `tools[].classification` — Reliable, 38/38 populated.
- Pricing label: `tools[].pricing` — Reliable, 38/38 populated.
- Tags: `tools[].tags[]` — Reliable, 38/38 contain at least one tag.
- Total directory count: number of `tools[]` records — Reliable at capture time, 38.

No visible sketch field depends on missing or proposed product data.

## Six records used in every variant

- AgentMail
- Circle Agent Stack
- Mem0
- Orthogonal
- PixelVault
- OneCLI

## Rich and sparse check

All 38 records score 7/7 for the seven visible field groups above, so there is no distinct sparse record for this surface. That is a useful result rather than a gap: the sketches do not need empty-field fallbacks for their current visible data.

For layout stress rather than availability:

- `Circle Agent Stack` has the longest tool name in the inspected dataset at 18 characters.
- `OneCLI` has the longest description in the inspected dataset at 103 characters.
- Both are included in all three variants and were checked at desktop and mobile widths.

## Deliberately omitted fields

The layouts do not introduce ratings, rankings, popularity, freshness scores, review counts, logos, or commercial claims. Those either are not part of the comparison goal or would imply evidence that the directory does not currently supply for this surface.
