type ReportRequest = {
  fileName?: string;
  analysis: {
    modality?: string;
    pathology: string;
    subclass?: string;
    confidence: number;
    insight?: string;
    pixels?: number;
    area?: number;
    modelUsed?: string;
    classId?: number;
    diagnosisConfidence?: number;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const HISTOLOGY_HEADINGS = [
  "File Reference",
  "Classification",
  "AI Confidence",
  "Analysis Date & Time",
  "Predicted Subclass",
  "Subclass ID",
  "Subclass Confidence",
  "Diagnosis Confidence",
  "Summary",
  "Impression",
  "Histopathological Features",
  "Risk Stratification",
  "Recommended Clinical Next Steps",
  "Management Considerations",
  "Limitations",
  "Disclaimer",
];

function buildPrompt(body: ReportRequest) {
  const a = body.analysis;
  const modality = (a.modality || "medical imaging").toLowerCase();
  const isHistology = modality.includes("histo");
  if (isHistology) {
    return `
Generate the narrative sections of a professional breast cancer histopathology analysis report for doctor review.

Rules:
- Return plain text only. Do not return JSON.
- Do not use markdown, code blocks, bullets, or numbered lists.
- Use only the provided findings.
- Do not invent values.
- Do not state a final diagnosis.
- Return only these headings exactly and in this order, with each section as a concise paragraph:
Summary:
Impression:
Histopathological Features:
Risk Stratification:
Recommended Clinical Next Steps:
Management Considerations:
Limitations:
Disclaimer:

Provided findings:
File Reference: ${body.fileName ?? "histology_scan"}
Classification: ${a.pathology}
AI Confidence: ${typeof a.confidence === "number" ? `${(a.confidence * 100).toFixed(1)}%` : "Unavailable from model output"}
Predicted Subclass: ${a.subclass ?? "Unavailable from model output"}
Subclass ID: ${a.classId != null ? String(a.classId) : "Unavailable from model output"}
Diagnosis Confidence: ${typeof a.diagnosisConfidence === "number" ? `${(a.diagnosisConfidence * 100).toFixed(1)}%` : "Unavailable from model output"}
Model Insight: ${a.insight ?? "Model identified subclass and diagnosis pattern for clinical review."}

Writing guidance:
- "Summary" should be a concise 1-2 sentence pathology-style paragraph using histomorphology language.
- "Impression" should be concise, authoritative, and avoid repeating the Summary.
- "Histopathological Features" must describe key microscopic features in one compact paragraph.
- "Risk Stratification" must explicitly say Low Risk, Moderate Risk, or High Risk and briefly justify it.
- "Recommended Clinical Next Steps" should be written as a short paragraph mentioning specialist consultation, confirmatory pathological review, imaging correlation, pathology confirmation, and multidisciplinary review in realistic workflow order.
- "Management Considerations" should be a brief paragraph mentioning general pathways such as surgery, chemotherapy, radiation therapy, or hormone therapy when appropriate.
- "Limitations" must mention AI limitations, image quality dependence, dataset bias, and that this is not a substitute for formal histopathological diagnosis.
- "Disclaimer" must clearly state that the AI report is for reference only and not for standalone diagnostic use.
- If a recognized subtype is implied, use commonly accepted histopathology terminology only.

Return exactly this structure:
Summary: ...
Impression: ...
Histopathological Features: ...
Risk Stratification: ...
Recommended Clinical Next Steps: ...
Management Considerations: ...
Limitations: ...
Disclaimer: ...
`.trim();
  }

  const reportKind = "ultrasound";
  return `
Create a concise suggestive ${reportKind} report draft for doctor review.

Rules:
- Use only the provided findings.
- Do not invent values.
- Do not give a final diagnosis.
- If a value is missing, write "Not provided".
- Use these headings exactly:
Summary:
Key Findings:
Impression:
Recommendation:
Disclaimer:

Findings:
- File: ${body.fileName ?? "Not provided"}
- Classification: ${a.pathology}
- Confidence: ${typeof a.confidence === "number" ? `${(a.confidence * 100).toFixed(1)}%` : "Not provided"}
- Pixel count: ${a.pixels ?? "Not provided"}
- Area (mm^2): ${a.area ?? "Not provided"}
- Model insight: ${a.insight ?? "Not provided"}
- Model used: ${a.modelUsed ?? "Not provided"}
`.trim();
}

function extractText(result: any): string {
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
    return chunks.join("\n");
  }

  return JSON.stringify(result);
}

function extractJSON(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/^```(?:json)?\s*/gm, "").replace(/\s*```$/gm, "");
  cleaned = cleaned.trim();
  
  // Try to extract JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function extractSections(text: string, headings: string[]) {
  const lines = text
    .replace(/^```(?:json)?\s*/gm, "")
    .replace(/\s*```$/gm, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Record<string, string> = {};
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) return;
    sections[currentHeading] = buffer.join(" ").trim();
    currentHeading = null;
    buffer = [];
  };

  for (const line of lines) {
    const matchedHeading = headings.find((heading) =>
      line.toLowerCase().startsWith(`${heading.toLowerCase()}:`)
    );

    if (matchedHeading) {
      flush();
      currentHeading = matchedHeading;
      const remainder = line.slice(matchedHeading.length + 1).trim();
      if (remainder) buffer.push(remainder);
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function buildHistologyFallback(body: ReportRequest, extractedText: string) {
  const a = body.analysis;
  const extractedSections = extractSections(extractedText, HISTOLOGY_HEADINGS);
  const subclass = a.subclass || "Histologic subtype identified by model";
  const diagnosis = a.pathology || "indeterminate";
  const subclassConfidence =
    typeof a.confidence === "number" ? `${(a.confidence * 100).toFixed(1)}%` : "Unavailable from model output";
  const diagnosisConfidence =
    typeof a.diagnosisConfidence === "number" ? `${(a.diagnosisConfidence * 100).toFixed(1)}%` : "Unavailable from model output";
  const insight = a.insight || "Model identified subclass and diagnosis pattern for clinical review.";
  const analysisTime = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const pixelCount = a.pixels != null ? String(a.pixels) : "Unavailable from model output";
  const area = a.area != null ? `${a.area} mm^2` : "Unavailable from model output";
  const riskLevel =
    diagnosis.toLowerCase() === "malignant"
      ? "High Risk"
      : diagnosis.toLowerCase() === "benign"
        ? "Moderate Risk"
        : "Low Risk";
  const lowerSubclass = subclass.toLowerCase();
  const subtypeFeatures =
    lowerSubclass.includes("ductal")
      ? "Invasive ductal-type architecture with malignant epithelial proliferation and desmoplastic stromal reaction"
      : lowerSubclass.includes("lobular")
        ? "Discohesive infiltrative cells with lobular-type growth pattern"
        : lowerSubclass.includes("phyllodes")
          ? "Leaf-like architecture with stromal overgrowth"
          : lowerSubclass.includes("fibroadenoma")
            ? "Circumscribed biphasic fibroepithelial pattern with benign stromal and epithelial components"
            : "Atypical cellular morphology with altered tissue organization";

  const templateSections: Record<string, string> = {
    "File Reference": body.fileName || "histology_scan",
    "Classification": diagnosis,
    "AI Confidence": subclassConfidence,
    "Analysis Date & Time": analysisTime,
    "Predicted Subclass": subclass,
    "Subclass ID": a.classId != null ? String(a.classId) : "Derived from model label set",
    "Subclass Confidence": extractedSections["Subclass Confidence"] || subclassConfidence,
    "Diagnosis Confidence": extractedSections["Diagnosis Confidence"] || diagnosisConfidence,
    "Summary":
      extractedSections["Summary"] ||
      `Breast tissue demonstrates morphologic features compatible with ${subclass} in a ${diagnosis.toLowerCase()} context, with AI findings supporting further histopathologic review. ${insight}`,
    "Impression":
      extractedSections["Impression"] ||
      `Impression suggests ${diagnosis.toLowerCase()} morphology with supporting AI confidence; formal pathology correlation is required.`,
    "Histopathological Features":
      extractedSections["Histopathological Features"] ||
      `${subtypeFeatures}; nuclear atypia and architectural distortion should be correlated with definitive microscopy; mitotic activity and stromal-epithelial relationships require pathologist confirmation.`,
    "Quantitative Findings":
      extractedSections["Quantitative Findings"] ||
      `Classification: ${diagnosis}; AI Confidence: ${subclassConfidence}; Diagnosis Confidence: ${diagnosisConfidence}.`,
    "Risk Stratification":
      extractedSections["Risk Stratification"] ||
      `${riskLevel}. Stratification is supported by subclass phenotype, model confidence, and the inferred degree of abnormal histologic architecture.`,
    "Recommended Clinical Next Steps":
      extractedSections["Recommended Clinical Next Steps"] ||
      `Recommend specialist consultation with breast oncology or surgical oncology, confirmatory pathological review to validate AI-based histological findings, imaging correlation, and multidisciplinary review to finalize histopathologic assessment and treatment planning.`,
    "Management Considerations":
      extractedSections["Management Considerations"] ||
      `Consider general management pathways such as surgery, chemotherapy, radiation therapy, and hormone-directed therapy as clinically appropriate after pathology confirmation of subtype, grade, and receptor status.`,
    "Limitations":
      extractedSections["Limitations"] ||
      `This AI-derived inference depends on image quality, representative sampling, and model training data. Dataset bias and technical variability may affect performance. It is not a substitute for formal histopathological diagnosis.`,
    "Disclaimer":
      extractedSections["Disclaimer"] ||
      "This draft is generated for preliminary review only. A qualified clinician must review, interpret, and confirm findings before forming a final diagnosis or treatment plan.",
  };

  return ["Analysis Report", ...HISTOLOGY_HEADINGS.map((heading) => `${heading}: ${templateSections[heading]}`)].join("\n");
}

function buildHistologyStructuredReport(body: ReportRequest, report: string) {
  const sections = extractSections(report, HISTOLOGY_HEADINGS);

  return {
    patientInfo: {},
    sections: [
      {
        title: "Header",
        subsections: [
          { label: "File Reference", content: sections["File Reference"] || body.fileName || "histology_scan" },
          { label: "Classification", content: sections["Classification"] || body.analysis.pathology, isHighlighted: true },
          { label: "AI Confidence", content: sections["AI Confidence"] || `${(body.analysis.confidence * 100).toFixed(1)}%` },
          { label: "Analysis Date & Time", content: sections["Analysis Date & Time"] || new Date().toLocaleString() },
        ],
      },
      {
        title: "Histological Subtype",
        description: "Core multi-class model outputs for subclass identification.",
        subsections: [
          { label: "Predicted Subclass", content: sections["Predicted Subclass"] || "Histologic subtype identified by model", isHighlighted: true },
          { label: "Subclass ID", content: sections["Subclass ID"] || "Derived from model label set" },
          { label: "Subclass Confidence", content: sections["Subclass Confidence"] || `${(body.analysis.confidence * 100).toFixed(1)}%` },
          { label: "Diagnosis Confidence", content: sections["Diagnosis Confidence"] || "Unavailable from model output" },
        ],
      },
      {
        title: "Summary",
        subsections: [
          { label: "Summary", content: sections["Summary"] || "Summary generated from model output." },
        ],
      },
      {
        title: "Impression",
        subsections: [
          { label: "Impression", content: sections["Impression"] || "Impression generated from model output." },
        ],
      },
      {
        title: "Histopathological Features",
        subsections: [
          { label: "Features", content: sections["Histopathological Features"] || "Histopathological feature summary generated from model output." },
        ],
      },
      {
        title: "Quantitative Findings",
        subsections: [
          { label: "Quantitative Findings", content: sections["Quantitative Findings"] || "Quantitative findings derived from available model output." },
        ],
      },
      {
        title: "Risk Stratification",
        subsections: [
          { label: "Risk Stratification", content: sections["Risk Stratification"] || "Risk category generated from available model output.", isHighlighted: true },
        ],
      },
      {
        title: "Recommended Clinical Next Steps",
        subsections: [
          { label: "Next Steps", content: sections["Recommended Clinical Next Steps"] || "Clinical next steps generated from available model output." },
        ],
      },
      {
        title: "Management Considerations",
        subsections: [
          { label: "Management", content: sections["Management Considerations"] || "Management considerations generated from available model output." },
        ],
      },
      {
        title: "Limitations",
        subsections: [
          { label: "Limitations", content: sections["Limitations"] || "Limitations generated from available model output." },
        ],
      },
      {
        title: "Disclaimer",
        description: "AI-generated reference only",
        subsections: [
          { label: "Clinical Use", content: sections["Disclaimer"] || "This report is AI-generated for reference only and must be reviewed by a qualified clinician." },
        ],
      },
    ],
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log(`[Worker] ${request.method} ${request.url}`);
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "") {
      console.log("[Worker] Health check OK");
      return Response.json(
        { status: "ok", message: "CF Report Worker is running" },
        { headers: corsHeaders }
      );
    }

    if (url.pathname !== "/report") {
      console.log(`[Worker] Unknown path: ${url.pathname}`);
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const body = (await request.json()) as ReportRequest;
      console.log("[Worker] Request body received:", JSON.stringify(body));

      if (!body?.analysis?.pathology) {
        console.log("[Worker] Missing analysis.pathology");
        return Response.json(
          { error: "analysis.pathology is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("[Worker] Calling AI model...");
      const aiResult = await env.AI.run("@cf/openai/gpt-oss-20b", {
        instructions:
          "You are a medical drafting assistant. Generate a suggestive report draft for doctors. Never invent missing values. Never state a final diagnosis. Always include a disclaimer that a clinician must review the output. Follow the requested heading template exactly.",
        input: buildPrompt(body),
        reasoning: { effort: "low" },
        max_tokens: 500,
      });

      console.log("[Worker] AI result received, extracting text...");
      const extractedText = extractText(aiResult);
      console.log("[Worker] Extracted text length:", extractedText.length);

      const modality = (body.analysis.modality || "medical imaging").toLowerCase();
      const isHistology = modality.includes("histo");

      if (isHistology) {
        const report = buildHistologyFallback(body, extractedText);
        const structuredReport = buildHistologyStructuredReport(body, report);
        console.log("[Worker] Returning normalized histology template report");
        return Response.json(
          {
            report,
            ...structuredReport,
            raw: aiResult,
            extractedText,
          },
          { headers: corsHeaders }
        );
      }
       
      const parsedJSON = extractJSON(extractedText);
      console.log("[Worker] JSON parsed:", !!parsedJSON);

      // If JSON parsing succeeded, return it directly as the report
      if (parsedJSON && typeof parsedJSON === "object") {
        console.log("[Worker] Returning structured JSON report");
        return Response.json(
          {
            report: JSON.stringify(parsedJSON),
            ...parsedJSON,
          },
          { headers: corsHeaders }
        );
      }

      // Fallback to plain text report
      console.log("[Worker] Returning text fallback report");
      return Response.json(
        {
          report: extractedText,
          raw: aiResult,
        },
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error("[Worker] Error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return Response.json(
        {
          error: "Report generation failed",
          details: errorMsg,
        },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
