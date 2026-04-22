import React, { useState, useEffect, useRef } from 'react';
import { UploadIcon, ModelIcon, VisionIcon, InfoIcon, DownloadIcon, PrintIcon } from '../components/icons';
import type { UploadedFile, AnalysisResult, HistoPrediction, StructuredReport } from '../types';
import { downloadReportAsPDF } from '../utils/downloadPDF';

const BACKEND_URL = 'http://127.0.0.1:8000';
const REPORT_WORKER_URL = '/report';

type ModelsResponse = { active_models?: string[]; histo_models?: string[] };

const toAnalysisPathology = (result?: string): AnalysisResult['pathology'] => {
  const n = (result || '').toLowerCase();
  if (n === 'malignant') return 'Malignant';
  if (n === 'benign') return 'Benign';
  if (n === 'normal') return 'Normal';
  return 'Inconclusive';
};

const deriveHistoModels = (data: ModelsResponse) => {
  if (Array.isArray(data.histo_models)) return data.histo_models.filter(m => m !== 'master');
  const active = Array.isArray(data.active_models) ? data.active_models : [];
  return active.filter(m => m === 'alexnet' || m === 'efficient_net' || m === 'yolo');
};

const splitSteps = (value: string) =>
  value.split(/\s(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);

/* ─────────────────────────────────────────────────────────────
   Surgical Pathology Report – standalone component
   ───────────────────────────────────────────────────────────── */
const PathologyReport: React.FC<{ file: UploadedFile; analysis: AnalysisResult }> = ({ file, analysis }) => {
  // Stable report ID tied to the file (not re-generated on every render)
  const reportIdRef = useRef(`ONCO-${Date.now().toString(36).toUpperCase()}`);
  const reportId = reportIdRef.current;

  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const p = analysis.pathology.toLowerCase();
  const isMalignant = p === 'malignant';
  const isBenign    = p === 'benign';
  const isNormal    = p === 'normal';

  const confidence   = `${(analysis.confidence * 100).toFixed(1)}%`;
  const riskLevel    = isMalignant ? 'High Risk' : isBenign ? 'Moderate Risk' : 'Low Risk';
  const borderColor  = isMalignant ? '#dc2626' : isBenign ? '#059669' : '#2563eb';
  const headerBg     = isMalignant ? 'bg-red-600'  : isBenign ? 'bg-emerald-600' : 'bg-blue-600';

  const diagLine1 = isMalignant
    ? `Malignant Tissue — High-Grade Histopathological Pattern Identified`
    : isBenign
    ? `Benign Tissue — No Malignant Features Detected`
    : isNormal
    ? `Normal Tissue — No Pathological Pattern Identified`
    : `Inconclusive — Pattern Could Not Be Definitively Classified`;

  const confidencePct = analysis.confidence * 100;
  const confBarColor = confidencePct < 40 ? '#dc2626' : confidencePct <= 80 ? '#f59e0b' : '#16a34a';
  const confBarLabel = confidencePct < 40 ? 'Low Confidence' : confidencePct <= 80 ? 'Moderate Confidence' : 'High Confidence';

  // Pull NLP-enriched text when available, fall back to inference-derived defaults
  const sr = file.structuredReport;
  const getS = (title: string) => sr?.sections.find(s => s.title === title)?.subsections?.[0]?.content;

  const clinicalHistory =
    getS('Summary') ||
    `Histopathology image submitted for AI-assisted single-class classification. ${analysis.insight}`;

  const microscopic =
    getS('Histopathological Features') ||
    `Sections demonstrate tissue architecture and cellular morphology consistent with ${analysis.pathology} classification. ` +
    `Nuclear and stromal pattern inferred by ${analysis.modelUsed}. ${analysis.insight}`;

  const impression =
    getS('Impression') ||
    `AI inference indicates ${analysis.pathology} morphology at ${confidence} confidence. Formal pathology correlation is required before any clinical decision.`;

  const nextStepsRaw =
    getS('Recommended Clinical Next Steps') ||
    '1. Arrange specialist oncology consultation. 2. Confirm findings with biopsy or formal histopathological review. 3. Correlate with mammography, MRI, or ultrasound as clinically appropriate. 4. Discuss in multidisciplinary tumor board when indicated. 5. Initiate management pathway based on confirmed subtype and grade.';

  const management =
    getS('Management Considerations') ||
    'General management pathways may include surgical intervention, chemotherapy, radiation therapy, and hormone-directed therapy depending on confirmed subtype, grade, receptor status, and stage.';

  const limitations =
    getS('Limitations') ||
    'This AI-derived inference depends on image quality, representative sampling, and model training data. Dataset bias and technical variability may affect performance. It is not a substitute for formal histopathological diagnosis.';

  const steps = splitSteps(nextStepsRaw);

  return (
    <div className="bg-white border-2 border-gray-400 shadow-2xl font-sans text-[13px] text-gray-900" id="pathology-report">

      {/* ══ HEADER ══ */}
      <div className="flex items-stretch border-b-2 border-gray-700">
        {/* Left: microscope thumb with uploaded scan */}
        <div className="w-20 flex-shrink-0 border-r border-gray-300 overflow-hidden">
          {file.previewUrl
            ? <img src={file.previewUrl} alt="scan thumb" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75H14.25M12 3.75V9M9 9H15M8.25 9C8.25 9 6 10.5 6 13.5C6 16.5 8.25 18 12 18C15.75 18 18 16.5 18 13.5C18 10.5 15.75 9 15.75 9M10.5 21H13.5M12 18V21" />
                </svg>
              </div>
          }
        </div>

        {/* Center meta */}
        <div className="flex-1 px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[11.5px]">
          <div><span className="font-bold">Case#:</span> {reportId}</div>
          <div><span className="font-bold">Facility:</span> OncoScanAI — AI Pathology Lab</div>
          <div><span className="font-bold">Patient File:</span> {file.name}</div>
          <div><span className="font-bold">MR#:</span> {reportId.replace('ONCO-', '')}</div>
          <div><span className="font-bold">Engine:</span> {analysis.modelUsed}</div>
          <div><span className="font-bold">Age/Sex:</span> N/A</div>
          <div><span className="font-bold">AI Confidence:</span> {confidence}</div>
          <div className="col-span-1"></div>
        </div>

        {/* Right: dates */}
        <div className="px-5 py-3 text-right text-[11.5px] border-l border-gray-300 flex-shrink-0 space-y-0.5">
          <div><span className="font-bold">Collected:</span> {reportDate}</div>
          <div><span className="font-bold">Received:</span>  {reportDate}</div>
          <div><span className="font-bold">Reported:</span>  {reportDate} {reportTime}</div>
        </div>
      </div>

      {/* ══ TITLE ══ */}
      <div className="text-center py-4 border-b border-gray-300 bg-gray-50">
        <h2 className="font-serif text-[1.5rem] font-bold tracking-wide text-gray-800">Surgical Pathology Report</h2>
        <p className="text-[10.5px] text-gray-500 mt-1 tracking-wide">AI-Assisted Histopathology Analysis · OncoScanAI Uni-HistoAnalysis</p>
      </div>

      {/* ══ DIAGNOSIS BOX ══ */}
      <div className={`mx-5 mt-4 ${headerBg}`}>
        <div className="px-3 py-1">
          <p className="text-white font-black text-[11px] uppercase tracking-widest">Diagnosis</p>
        </div>
        <div className="bg-white border-l-4 border-r-4 border-b-4 px-4 py-3" style={{ borderColor }}>
          <p className="font-bold text-[13px] leading-6">1. {diagLine1}</p>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">AI Confidence</span>
              <span className="text-[11px] font-black" style={{ color: confBarColor }}>{confidence} — {confBarLabel}</span>
            </div>
            <div className="h-3 w-64 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: confidence, backgroundColor: confBarColor }} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ NOTE ══ */}
      <p className="mx-5 mt-3 text-[11.5px] leading-5 text-gray-700">
        <span className="font-bold">NOTE:</span> Breast marker / IHC analysis and molecular confirmatory testing may be required.
        An addendum report will be issued following pathologist review. Results were reviewed by the AI engine only and must be
        validated by a qualified pathologist before any clinical decision is made.
      </p>

      {/* ══ IMAGE STRIP ══ */}
      {file.previewUrl && (
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Core Biopsies, Low Power',       filter: 'none' },
            { label: 'Infiltrating Tissue Pattern',     filter: 'contrast(1.2) saturate(1.25)' },
            { label: 'Focal Gland Formation',           filter: 'contrast(1.35) brightness(0.88) saturate(0.75)' },
          ].map((img, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-full h-36 border border-gray-400 overflow-hidden bg-gray-900">
                <img
                  src={file.previewUrl}
                  alt={img.label}
                  className="w-full h-full object-cover"
                  style={{ filter: img.filter }}
                />
              </div>
              <p className="text-[10px] text-center text-gray-600 mt-1 leading-tight">{img.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ══ CLINICAL SECTIONS ══ */}
      <div className="mx-5 mt-4 mb-5 text-[12.5px] text-gray-800">

        {[
          {
            label: 'Clinical History',
            content: <span className="leading-[1.9]">{clinicalHistory}</span>,
          },
          {
            label: 'Sites',
            content: <span className="leading-[1.9]">Histology image — single core biopsy or whole-slide scan submitted for AI single-class classification.</span>,
          },
          {
            label: 'Gross',
            content: <span className="leading-[1.9]">Received as a scanned histological image ({file.size}). Submitted for single-class inference using the {analysis.modelUsed} engine. Image processed at full resolution. Classification result: <strong>{analysis.pathology}</strong>.</span>,
          },
          {
            label: 'Microscopic',
            content: <span className="leading-[1.9]">{microscopic}</span>,
          },
          {
            label: 'Impression',
            content: <span className="leading-[1.9]">{impression}</span>,
          },
          {
            label: 'Management Considerations',
            content: <span className="leading-[1.9]">{management}</span>,
          },
          {
            label: 'Limitations',
            content: <span className="leading-[1.9]">{limitations}</span>,
          },
          {
            label: 'Previous BX / AI History',
            content: <span className="leading-[1.9]">No prior AI scan history available for this session.</span>,
          },
        ].map((section, i) => (
          <div key={i} className={`py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <span className="font-serif font-bold text-[12px] uppercase tracking-widest text-gray-700">{section.label}: </span>
            {section.content}
          </div>
        ))}

        {/* Recommended Clinical Next Steps — separate because it has a list */}
        <div className="py-3 border-t border-gray-100">
          <p className="font-serif font-bold text-[12px] uppercase tracking-widest text-gray-700 mb-2">Recommended Clinical Next Steps:</p>
          <div className="pl-4 space-y-1.5">
            {(steps.length ? steps : [nextStepsRaw]).map((step, i) => (
              <p key={i} className="leading-[1.9]"><span className="font-semibold text-gray-600">{i + 1}.</span> {step.replace(/^\d+\.\s*/, '')}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div className="border-t border-gray-100 mx-5 pt-3 pb-3 flex items-center justify-between">
        <p className="font-serif text-[10.5px] text-gray-400 italic max-w-lg leading-[1.8]">
          This AI-generated report is a preliminary draft for clinical reference only.
          A licensed pathologist must review and sign off before any diagnostic or treatment decision is made.
        </p>
        <div className="text-right text-[10px] text-gray-400 font-mono">
          <p>{reportId}</p>
          <p>OncoScanAI v2</p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main page component
   ───────────────────────────────────────────────────────────── */
const VisionWorkbench: React.FC = () => {
  const [files, setFiles]                 = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [activeModel, setActiveModel]     = useState<string>('');
  const [isDragging, setIsDragging]       = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const getModelDisplayName = (key: string) =>
    ({ alexnet: 'AlexNet', yolo: 'YOLO V11', efficient_net: 'EfficientNet' }[key] ?? key.toUpperCase());

  const selectedFile = files.find(f => f.id === selectedFileId);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/models`);
        if (res.ok) {
          const data = await res.json() as ModelsResponse;
          const models = deriveHistoModels(data);
          setAvailableModels(models);
          if (models.length > 0)
            setActiveModel(models.find(m => m === 'alexnet') ?? models[0]);
        }
      } catch { /* backend offline */ }
      finally { setIsLoadingModels(false); }
    })();
  }, []);

  const updateFile = (id: string, fn: (f: UploadedFile) => UploadedFile) =>
    setFiles(prev => prev.map(f => f.id === id ? fn(f) : f));

  /* Fetch NLP enrichment from worker (optional — enhances text only) */
  const fetchNLPEnrichment = async (fileId: string, fileName: string, analysis: AnalysisResult) => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(REPORT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fileName,
          analysis: {
            modality: 'histopathology',
            pathology: analysis.pathology,
            subclass: analysis.pathology,
            confidence: analysis.confidence,
            insight: analysis.insight,
            modelUsed: analysis.modelUsed,
          },
        }),
      });
      clearTimeout(timeoutId);
      if (!res.ok) return;

      type WR = { report?: string; sections?: unknown[]; patientInfo?: Record<string, string> };
      const json = await res.json() as WR;

      let structuredReport: StructuredReport | null = null;
      if (json.sections && Array.isArray(json.sections)) {
        structuredReport = { patientInfo: json.patientInfo, sections: json.sections as StructuredReport['sections'] };
      } else if (json.report) {
        try {
          const m = json.report.match(/\{[\s\S]*\}/);
          if (m) {
            const p = JSON.parse(m[0]) as { sections?: unknown[] };
            if (p.sections) structuredReport = p as StructuredReport;
          }
        } catch { /* ignore */ }
      }
      if (structuredReport)
        updateFile(fileId, f => ({ ...f, structuredReport, reportStatus: 'Complete' }));
    } catch {
      clearTimeout(timeoutId);
      /* worker offline / timed out — report still renders from inference data */
    }
    updateFile(fileId, f => f.reportStatus === 'Generating' ? { ...f, reportStatus: 'Complete' } : f);
  };

  const handleAnalysis = async (fileId: string, rawFile: File, modelName: string) => {
    if (!modelName) return;
    updateFile(fileId, f => ({ ...f, status: 'Analyzing' }));

    const formData = new FormData();
    formData.append('file', rawFile);

    try {
      const res = await fetch(`${BACKEND_URL}/predict/histo/${modelName}`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as HistoPrediction;
      const analysis: AnalysisResult = {
        pathology:  toAnalysisPathology(data.result),
        confidence: data.confidence,
        insight:    data.insight || 'The selected model completed the histology analysis.',
        modelUsed:  getModelDisplayName(modelName),
      };

      // Immediately mark as Complete so the report renders right away
      updateFile(fileId, f => ({ ...f, status: 'Complete', analysis, reportStatus: 'Generating' }));

      // Kick off NLP enrichment in background — does not block render
      await fetchNLPEnrichment(fileId, rawFile.name, analysis);
    } catch (err) {
      updateFile(fileId, f => ({ ...f, status: 'Failed', errorMessage: String(err) }));
    }
  };

  const onFileDrop = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let rawFiles: File[] = [];
    if ('dataTransfer' in e) { e.preventDefault(); rawFiles = Array.from(e.dataTransfer.files); }
    else rawFiles = e.target.files ? Array.from(e.target.files) : [];

    const newFiles: UploadedFile[] = rawFiles.map(rf => ({
      id: Math.random().toString(36).substr(2, 9),
      name: rf.name,
      size: (rf.size / 1024).toFixed(1) + ' KB',
      status: 'Pending',
      type: rf.name.split('.').pop() || 'unknown',
      previewUrl: URL.createObjectURL(rf),
      reportStatus: 'Idle',
    }));

    setFiles(prev => [...newFiles, ...prev]);
    if (newFiles.length > 0) setSelectedFileId(newFiles[0].id);
    newFiles.forEach((nf, i) => handleAnalysis(nf.id, rawFiles[i], activeModel));
  };

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* ══ TOP: Upload zone + engine selector + queue ══ */}
      <div className="relative rounded-2xl shadow-subtle border border-slate-200 overflow-hidden">
        {/* Dot-grid background */}
        <div className="absolute inset-0 dot-grid-bg opacity-40 pointer-events-none" />
        <div className="relative bg-white/80 backdrop-blur-sm p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Engine selector */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                Active Engine
                {isLoadingModels && <div className="w-3 h-3 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />}
              </label>
              <div className="flex flex-wrap gap-2">
                {availableModels.length === 0 && !isLoadingModels
                  ? <p className="text-[10px] text-slate-400 font-bold">No histology models detected. Add alexnet.pth, efficient_net.pth, or yolov11.pth</p>
                  : availableModels.map(m => (
                      <button key={m} onClick={() => setActiveModel(m)}
                        className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeModel === m ? 'bg-brand-pink text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {getModelDisplayName(m)}
                        {activeModel === m && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </button>
                    ))
                }
              </div>
            </div>

            {/* Drop zone — animated gradient border when idle */}
            <div
              className={`rounded-xl px-6 py-8 transition-all cursor-pointer ${isDragging ? 'bg-pink-50 scale-[1.02]' : 'upload-zone-idle bg-white/70'}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { setIsDragging(false); onFileDrop(e); }}
            >
              <input type="file" id="file-upload" className="hidden" multiple onChange={onFileDrop} />
              <label htmlFor="file-upload" className="flex items-center gap-4 cursor-pointer w-full">
                {/* Live preview thumbnail — shows last uploaded scan */}
                {files.length > 0 && files[0].previewUrl ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-brand-pink shadow-md flex-shrink-0">
                    <img src={files[0].previewUrl} alt="preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <UploadIcon className="w-7 h-7 text-brand-pink" />
                  </div>
                )}
                <div>
                  <p className="text-base font-bold text-slate-700">
                    {files.length > 0 ? `${files.length} scan${files.length > 1 ? 's' : ''} loaded · ` : ''}
                    <span className="text-brand-pink underline">Browse or Drop</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, TIFF, SVS supported</p>
                </div>
              </label>
            </div>

            {/* Scan queue */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Queue</p>
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{files.length}</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {files.length === 0
                  ? <p className="text-[10px] text-slate-400 text-center py-2">No scans uploaded yet</p>
                  : files.map(f => (
                      <button key={f.id} onClick={() => setSelectedFileId(f.id)}
                        className={`w-full flex items-center p-1.5 rounded-lg transition-all ${selectedFileId === f.id ? 'bg-pink-50 ring-1 ring-brand-pink' : 'hover:bg-slate-50'}`}>
                        <div className="w-7 h-7 rounded-md bg-slate-200 mr-2 flex-shrink-0 overflow-hidden">
                          <img src={f.previewUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                        <p className="text-[10px] font-bold truncate text-slate-700 flex-grow text-left">{f.name}</p>
                        <span className={`text-[9px] font-black uppercase ml-1 flex-shrink-0 ${f.status === 'Complete' ? 'text-green-600' : f.status === 'Failed' ? 'text-red-500' : 'text-slate-400'}`}>{f.status}</span>
                        {f.status === 'Analyzing' && <div className="w-2 h-2 border-2 border-brand-pink border-t-transparent rounded-full animate-spin ml-1 flex-shrink-0" />}
                      </button>
                    ))
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ GRADIENT SEPARATOR ══ */}
      <hr className="gradient-separator" />

      {/* ══ BOTTOM: Report (left) + Model Results (right) ══ */}
      {selectedFile ? (
        selectedFile.status === 'Complete' && selectedFile.analysis ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1 min-h-0">

            {/* LEFT — Model Results */}
            <div className="overflow-y-auto flex flex-col gap-5">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Model Results</h3>

              {/* Scan image */}
              <div className="relative group">
                <div className="h-60 bg-slate-900 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center border-4 border-slate-50">
                  <img src={selectedFile.previewUrl} className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity" alt="Scan" />
                </div>
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest">Diagnostic View</div>
              </div>

              {/* Pathology badge + confidence */}
              <div className={`p-5 rounded-2xl border-2 ${selectedFile.analysis.pathology === 'Malignant' ? 'bg-red-50/50 border-red-100' : selectedFile.analysis.pathology === 'Benign' ? 'bg-green-50/50 border-green-100' : 'bg-blue-50/50 border-blue-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white ${selectedFile.analysis.pathology === 'Malignant' ? 'bg-red-500' : selectedFile.analysis.pathology === 'Benign' ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {selectedFile.analysis.pathology}
                  </span>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confidence</p>
                    <p className="text-2xl font-black text-slate-800">{(selectedFile.analysis.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner">
                  <div className={`h-full transition-all duration-[1500ms] ease-out ${selectedFile.analysis.pathology === 'Malignant' ? 'bg-red-500' : selectedFile.analysis.pathology === 'Benign' ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${selectedFile.analysis.confidence * 100}%` }} />
                </div>
              </div>

              {/* Neural insight */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-brand-pink/10 flex items-center justify-center">
                    <InfoIcon className="w-3.5 h-3.5 text-brand-pink" />
                  </div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Neural Insight</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{selectedFile.analysis.insight}"</p>
              </div>

              {/* Engine info */}
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                    <ModelIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Engine</p>
                    <p className="text-xs font-bold text-slate-700">{selectedFile.analysis.modelUsed}</p>
                  </div>
                </div>
                <button className="px-5 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all">
                  Confirm Diagnosis
                </button>
              </div>
            </div>

            {/* RIGHT — Surgical Pathology Report */}
            <div className="overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Surgical Pathology Report</h3>
                <div className="flex items-center gap-2">
                  {selectedFile.reportStatus === 'Generating' && (
                    <span className="text-[9px] font-bold text-brand-pink animate-pulse uppercase tracking-widest">Generating…</span>
                  )}
                  <button
                    onClick={() => selectedFile.analysis && fetchNLPEnrichment(selectedFile.id, selectedFile.name, selectedFile.analysis)}
                    disabled={selectedFile.reportStatus === 'Generating'}
                    className="px-3 py-1.5 bg-brand-pink text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-pink-dark disabled:opacity-50 transition-all">
                    Regenerate
                  </button>
                  <button
                    onClick={() => downloadReportAsPDF('pathology-report', `UniHisto-Report-${selectedFile.name.replace(/\.[^/.]+$/, '')}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#1e40af] transition-all">
                    <DownloadIcon className="w-3 h-3" />
                    Download PDF
                  </button>
                </div>
              </div>
              <PathologyReport file={selectedFile} analysis={selectedFile.analysis} />
            </div>
          </div>
        ) : selectedFile.status === 'Failed' ? (
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 text-center p-12 flex-1">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <InfoIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Analysis Failed</h3>
            <p className="text-slate-500 text-sm max-w-xs mb-6">{selectedFile.errorMessage}</p>
            <button onClick={() => handleAnalysis(selectedFile.id, new File([], selectedFile.name), activeModel)}
              className="px-6 py-2.5 border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:border-brand-pink hover:text-brand-pink transition-all">
              Retry Inference
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 text-center p-16 flex-1">
            <div className="relative mb-6">
              <div className="w-24 h-24 border-2 border-brand-pink/20 rounded-full animate-[spin_3s_linear_infinite]" />
              <div className="w-24 h-24 border-t-2 border-brand-pink rounded-full animate-spin absolute inset-0" />
              <VisionIcon className="w-8 h-8 text-brand-pink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h3 className="text-base font-black text-slate-800">Running Neural Analysis…</h3>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center p-16 flex-1">
          <VisionIcon className="w-12 h-12 text-slate-200 mb-4" />
          <h2 className="text-xl font-black text-slate-700 mb-2">Neural Workbench Ready</h2>
          <p className="text-slate-400 text-sm">Upload a histology scan above to begin analysis and generate a report.</p>
        </div>
      )}
    </div>
  );
};

export default VisionWorkbench;
