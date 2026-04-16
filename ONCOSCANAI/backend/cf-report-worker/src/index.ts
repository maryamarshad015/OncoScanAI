type ReportRequest = {
  fileName?: string;
  analysis: {
    pathology: string;
    confidence: number;
    insight?: string;
    pixels?: number;
    area?: number;
  };
};

type StructuredReport = {
  summary: string;
  impression: string;
  recommendedClinicalNextSteps: string[];
  disclaimer: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const REQUIRED_DISCLAIMER =
  "This report is AI-generated for reference purposes only. It does not constitute a medical diagnosis. All findings must be reviewed, verified, and acted upon solely by a qualified licensed medical professional.";

function formatConfidence(confidence?: number) {
  return typeof confidence === "number" && Number.isFinite(confidence)
    ? `${(confidence * 100).toFixed(1)}%`
    : "Not provided";
}

function buildPrompt(body: ReportRequest) {
  const a = body.analysis;

  return `
Generate a structured suggestive breast ultrasound report draft for doctor review in a breast cancer detection workflow.

STRICT RULES:
- Use only the provided findings. Never invent or assume missing values.
- If a value is missing, write exactly: Not provided
- Never state or imply a final diagnosis.
- Do not mention model names, algorithms, vendors, or internal system details.
- Use the terms "AI Confidence" and "AI Insight" if you refer to those inputs.
- Do not include sections or advice about Potential Causes, Lifestyle Advice, Dietary Recommendations, or Skin Care Regimens.
- The application will render the visual category row and styled layout itself, so do not output HTML, CSS, or markdown.
- Focus on clinically appropriate professional next steps after an AI-assisted breast ultrasound result. Tailor the steps to the reported classification, AI Confidence, lesion burden, and AI Insight using proportionate clinical reasoning.
- Determine the next steps yourself from the findings provided. Do not copy generic boilerplate recommendations unless they are clearly justified by the findings.
- Internally reason about the level of concern and escalate the recommendations proportionately:
  Normal Tissue -> lowest intensity follow-up language
  Benign -> conservative or confirmatory professional follow-up
  Inconclusive, unclear, or incomplete findings -> additional diagnostic clarification or tissue confirmation as clinically appropriate
  Malignant -> urgent confirmation, pathology-directed workup, and oncologic planning language as clinically appropriate
- Appropriate professional next-step categories may include clinical correlation, additional breast imaging review, short-interval imaging follow-up, specialist evaluation, image-guided tissue sampling or biopsy, pathology confirmation, receptor or biomarker testing after confirmed malignancy, staging workup when clinically appropriate, and multidisciplinary review.
- Do not prescribe definitive treatment such as chemotherapy, surgery, radiation therapy, endocrine therapy, or laser treatment as already indicated unless confirmed pathology or staging details are explicitly provided in the findings.
- Write the next-step list for the treating doctor, not for the patient.
- Each next step must be phrased as a clinician-facing management recommendation, using wording such as "Recommend...", "Consider...", "Correlate...", "Arrange...", "Discuss...", or "Plan...".
- Do not write patient-directed instructions like "Refer to", "Obtain", "Go for", "You should", or other phrasing that reads as advice given directly to the patient.
- If malignancy has not been pathologically confirmed, frame invasive treatment planning as contingent language such as "If malignancy is confirmed on pathology, consider..." or "Following tissue confirmation, discuss...".
- Produce 3 to 5 next steps, ordered from immediate diagnostic priorities to downstream management considerations.
- Each next step must be specific, professional, and justified by the current findings, not a fixed reusable phrase.
- Always use the disclaimer exactly as provided.

RETURN FORMAT:
Return valid JSON only. Do not wrap the JSON in markdown fences. Use this exact shape:
{
  "summary": "2-3 sentences in plain clinical language describing the AI-reported finding. Explicitly state that clinician correlation is required before action.",
  "impression": "1-2 sentences describing the AI-detected pattern only and clearly stating that it is a model-generated impression, not a clinical diagnosis.",
  "recommendedClinicalNextSteps": [
    "Professional management recommendation 1",
    "Professional management recommendation 2",
    "Professional management recommendation 3"
  ],
  "disclaimer": "${REQUIRED_DISCLAIMER}"
}

INPUT FINDINGS:
- File Reference: ${body.fileName ?? "Not provided"}
- Classification: ${a.pathology}
- AI Confidence: ${formatConfidence(a.confidence)}
- Pixel Count: ${a.pixels ?? "Not provided"}
- Area (mm\u00B2): ${a.area ?? "Not provided"}
- AI Insight: ${a.insight ?? "Not provided"}
`.trim();
}

function extractText(result: any) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.output_text === "string") return result.output_text;

  const chunks: string[] = [];
  for (const item of result?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  if (chunks.length > 0) {
    return chunks.join("\n\n");
  }

  return JSON.stringify(result);
}

function extractJsonCandidate(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return trimmed;
  }

  return trimmed.slice(start, end + 1);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parseStructuredReport(text: string): StructuredReport | null {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text));
    const summary = normalizeText(parsed?.summary);
    const impression = normalizeText(parsed?.impression);
    const recommendedClinicalNextSteps = normalizeStringArray(parsed?.recommendedClinicalNextSteps);

    if (!summary && !impression && recommendedClinicalNextSteps.length === 0) {
      return null;
    }

    return {
      summary: summary || "Not provided",
      impression: impression || "Not provided",
      recommendedClinicalNextSteps:
        recommendedClinicalNextSteps.length > 0 ? recommendedClinicalNextSteps : ["Not provided"],
      disclaimer: REQUIRED_DISCLAIMER,
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/report") {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = (await request.json()) as ReportRequest;

    if (!body?.analysis?.pathology) {
      return Response.json(
        { error: "analysis.pathology is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const aiResult = await env.AI.run("@cf/openai/gpt-oss-20b", {
      instructions:
        "You are a clinician-facing medical drafting assistant for AI-assisted breast ultrasound review. Return valid JSON only.",
      input: buildPrompt(body),
      reasoning: { effort: "low" },
      max_tokens: 700,
    });

    const reportText = extractText(aiResult);
    const report = parseStructuredReport(reportText);

    return Response.json(
      {
        report,
        reportText,
        raw: aiResult,
      },
      { headers: corsHeaders }
    );
  },
};
