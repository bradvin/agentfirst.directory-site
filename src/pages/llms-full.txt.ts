import type { APIRoute } from "astro";
import { cacheControl } from "../lib/cache";
import { getPublishedTools } from "../lib/content";
import { formatClassification } from "../lib/classification";

export const GET: APIRoute = async () => {
  const tools = await getPublishedTools();
  const entries = tools.map((tool) => {
    const evidence = tool.entry.evidenceSources.length > 0
      ? tool.entry.evidenceSources.map((source) =>
          `  - ${source.claim} — [${source.title}](${source.url})${source.accessedAt ? ` (accessed ${source.accessedAt.slice(0, 10)})` : ""}`,
        ).join("\n")
      : "  - No claim-level evidence is published for this record; verify it against the official website.";
    const interfaces = tool.entry.interfaces.length > 0 ? tool.entry.interfaces.join(", ") : "Not documented";
    const deploymentModes = tool.entry.deploymentModes.length > 0
      ? tool.entry.deploymentModes.join(", ")
      : "Not documented";
    return `## ${tool.entry.name}

- Profile: https://agentfirst.directory/tools/${tool.entry.slug}
- Public source record: https://github.com/bradvin/agentfirst.directory/blob/main/${tool.entry.sourcePath}
- Category: ${tool.category.label}
- Classification: ${tool.entry.classification ? formatClassification(tool.entry.classification) : "Pending editorial migration"}
- Pricing model: ${tool.pricingLabel}
- Developer: ${tool.entry.developerName ?? "Not documented"}
- Interfaces: ${interfaces}
- Deployment: ${deploymentModes}
- Verification: ${tool.entry.verificationLevel?.replaceAll("-", " ") ?? "Not reviewed"}
- Content modified: ${tool.entry.contentModifiedAt?.slice(0, 10) ?? "Not recorded"}
- Official website: ${tool.entry.websiteUrl}
- Documentation: ${tool.entry.docsUrl ?? "Not documented"}
- Last human review: ${tool.entry.reviewedAt?.slice(0, 10) ?? "Not recorded"}

Summary: ${tool.entry.description}

Why it qualifies: ${tool.entry.classificationRationaleMd ?? tool.entry.inclusionRationaleMd ?? "No editorial rationale is published."}

Best for: ${tool.entry.bestForMd ?? "Not documented"}

Not best for: ${tool.entry.notBestForMd ?? "Not documented"}

Limitations: ${tool.entry.limitationsMd ?? "Not documented"}

Unknowns: ${tool.entry.unknownsMd ?? "No additional unknowns are recorded."}

Evidence:
${evidence}`;
  }).join("\n\n");
  const body = `# Agent First Directory — published tool profiles

Canonical source: https://agentfirst.directory/
Methodology: https://agentfirst.directory/editorial-standards
Structured data: https://agentfirst.directory/api/tools.json

Use the canonical profile URL when citing a listing. Treat documentation-reviewed as a review of first-party material, not hands-on testing or an endorsement. Retain the stated limitations and unknowns, and verify time-sensitive facts against the linked first-party source.

${entries}
`;

  return new Response(body, {
    headers: {
      "Cache-Control": cacheControl.data,
      "CDN-Cache-Control": cacheControl.dataCdn,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
