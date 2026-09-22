import type { APIRoute } from "astro";
import { handleSubmissionEvidenceRequest } from "../../lib/submission-evidence";

export const POST: APIRoute = ({ request }) => handleSubmissionEvidenceRequest(request);
