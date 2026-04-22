import React, { useState, useRef } from 'react';
import type { HistoPrediction, UploadedFile, StructuredReport } from '../types';
import { UploadIcon, InfoIcon, VisionIcon, LiveIcon, ModelIcon, DownloadIcon } from '../components/icons';
import { downloadReportAsPDF } from '../utils/downloadPDF';

type WorkerReportResponse = { report?: string; patientInfo?: Record<string, string>; sections?: unknown[] };
type ErrorResponse = { detail?: string };

const REPORT_WORKER_URL = '/report';

/* ── helpers ── */
const getPredictionFields = (p?: HistoPrediction) => {
  const subclass = p?.subclass_prediction || p?.subclass || p?.result || 'unknown';
  const diagnosis = p?.diagnosis_prediction || p?.diagnosis || p?.pathology_group || 'unknown';
  return { subclass, subclassLabel: subclass.replace(/_/g, ' '), diagnosis };
};

const splitSteps = (v: string) => v.split(/\s(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);

const getDiagnosisBadgeClass = (d?: string) => {
  const v = (d || '').toLowerCase();
  if (v === 'malignant') return 'bg-red-100 text-red-700';
  if (v === 'benign')    return 'bg-green-100 text-green-700';
  if (v === 'normal')    return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
};

/* ─────────────────────────────────────────────────────────
   Surgical Pathology Report document (Multi-Class variant)
   ───────────────────────────────────────────────────────── */
const MultiPathologyReport: React.FC<{ file: UploadedFile; prediction: HistoPrediction }> = ({ file, prediction }) => {
  const reportIdRef = useRef(`ONCO-${Date.now().toString(36).toUpperCase()}`);
  const reportId = reportIdRef.current;

  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const fields       = getPredictionFields(prediction);
  const diagnosis    = fields.diagnosis.toLowerCase();
  const isMalignant  = diagnosis === 'malignant';
  const isBenign     = diagnosis === 'benign';

  const subclassConf  = prediction.confidence != null ? `${(prediction.confidence * 100).toFixed(1)}%` : 'N/A';
  const diagConf      = prediction.pathology_confidence != null
    ? `${(prediction.pathology_confidence * 100).toFixed(1)}%`
    : subclassConf;

  const riskLevel    = isMalignant ? 'High Risk' : isBenign ? 'Moderate Risk' : 'Low Risk';
  const borderColor  = isMalignant ? '#dc2626' : isBenign ? '#059669' : '#2563eb';
  const headerBg     = isMalignant ? 'bg-red-600'  : isBenign ? 'bg-emerald-600' : 'bg-blue-600';

  const diagLine1 = isMalignant
    ? `Infiltrating ${fields.subclassLabel}, Malignant — OncoScanAI Master Model`
    : isBenign
    ? `${fields.subclassLabel}, Benign Tissue — No Malignant Features`
    : `${fields.subclassLabel} — ${fields.diagnosis} Tissue Pattern`;

  const subclassPct = (prediction.confidence ?? 0) * 100;
  const confBarColor = subclassPct < 40 ? '#dc2626' : subclassPct <= 80 ? '#f59e0b' : '#16a34a';
  const confBarLabel = subclassPct < 40 ? 'Low Confidence' : subclassPct <= 80 ? 'Moderate Confidence' : 'High Confidence';

  // Pull NLP enrichment when worker has already responded
  const sr = file.structuredReport;
  const getS = (title: string) => sr?.sections.find(s => s.title === title)?.subsections?.[0]?.content;

  const clinicalHistory =
    getS('Summary') ||
    `Breast histopathology image submitted for AI-assisted multi-class classification. ` +
    `Predicted subclass: ${fields.subclassLabel}. ${prediction.insight || ''}`;

  const microscopic =
    getS('Histopathological Features') ||
    `Atypical cellular morphology with disturbed tissue architecture in keeping with ${fields.subclassLabel}; ` +
    `nuclear atypia and stromal-epithelial relationships are inferred by the OncoScanAI Master model and require pathologist confirmation.`;

  const impression =
    getS('Impression') ||
    `Impression suggests ${fields.diagnosis} morphology with subclass confidence of ${subclassConf}; formal pathology correlation is required.`;

  const nextStepsRaw =
    getS('Recommended Clinical Next Steps') ||
    '1. Arrange specialist consultation with breast oncology or surgical oncology. 2. Recommend confirmatory pathological review to validate AI-based histological findings. 3. Correlate with mammography, MRI, or ultrasound as clinically appropriate. 4. Confirm subtype and grade on pathology review. 5. Discuss in a multidisciplinary tumor board setting when indicated.';

  const management =
    getS('Management Considerations') ||
    'General management pathways may include surgical intervention, chemotherapy, radiation therapy, and when biologically appropriate, hormone-directed therapy depending on confirmed subtype, grade, receptor status, and stage.';

  const limitations =
    getS('Limitations') ||
    'This AI-derived inference depends on image quality, representative sampling, and model training data. Dataset bias and technical variability may affect performance. It is not a substitute for formal histopathological diagnosis.';

  const steps = splitSteps(nextStepsRaw);

  return (
    <div className="bg-white border-2 border-gray-400 shadow-2xl font-sans text-[13px] text-gray-900" id="pathology-report-multi">

      {/* ══ HEADER ══ */}
      <div className="flex items-stretch border-b-2 border-gray-700">
        {/* Scan thumbnail */}
        <div className="w-20 flex-shrink-0 border-r border-gray-300 overflow-hidden">
          {file.previewUrl
            ? <img src={file.previewUrl} alt="scan thumb" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <VisionIcon className="w-8 h-8 text-gray-300" />
              </div>
          }
        </div>

        {/* Meta */}
        <div className="flex-1 px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[11.5px]">
          <div><span className="font-bold">Case#:</span> {reportId}</div>
          <div><span className="font-bold">Facility:</span> OncoScanAI — AI Pathology Lab</div>
          <div><span className="font-bold">Patient File:</span> {file.name}</div>
          <div><span className="font-bold">MR#:</span> {reportId.replace('ONCO-', '')}</div>
          <div><span className="font-bold">Engine:</span> OncoScanAI Master Model</div>
          <div><span className="font-bold">Age/Sex:</span> N/A</div>
          <div><span className="font-bold">Subclass Confidence:</span> {subclassConf}</div>
          <div><span className="font-bold">Diagnosis Confidence:</span> {diagConf}</div>
        </div>

        {/* Dates */}
        <div className="px-5 py-3 text-right text-[11.5px] border-l border-gray-300 flex-shrink-0 space-y-0.5">
          <div><span className="font-bold">Collected:</span> {reportDate}</div>
          <div><span className="font-bold">Received:</span>  {reportDate}</div>
          <div><span className="font-bold">Reported:</span>  {reportDate} {reportTime}</div>
        </div>
      </div>

      {/* ══ TITLE ══ */}
      <div className="text-center py-4 border-b border-gray-300 bg-gray-50">
        <h2 className="font-serif text-[1.5rem] font-bold tracking-wide text-gray-800">Surgical Pathology Report</h2>
        <p className="text-[10.5px] text-gray-500 mt-1 tracking-wide">AI-Assisted Multi-Class Histopathology Analysis · OncoScanAI Master Model</p>
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
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Subclass Confidence</span>
              <span className="text-[11px] font-black" style={{ color: confBarColor }}>{subclassConf} — {confBarLabel}</span>
            </div>
            <div className="h-3 w-64 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: subclassConf, backgroundColor: confBarColor }} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ NOTE ══ */}
      <p className="mx-5 mt-3 text-[11.5px] leading-5 text-gray-700">
        <span className="font-bold">NOTE:</span> Breast marker / IHC analysis (e.g. ER, PR, HER2) and molecular confirmatory
        testing may be required. An addendum report will be issued following pathologist review. Results must be validated by
        a qualified pathologist before any clinical decision is made.
      </p>

      {/* ══ IMAGE STRIP ══ */}
      {file.previewUrl && (
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Core Biopsies, Low Power',              filter: 'none' },
            { label: `${fields.subclassLabel} Pattern`,       filter: 'contrast(1.2) saturate(1.25)' },
            { label: 'Focal Gland / Tissue Formation',        filter: 'contrast(1.35) brightness(0.88) saturate(0.75)' },
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

      {/* ══ SUBTYPE PANEL ══ */}
      <div className="mx-5 mt-5 border border-gray-300 rounded p-4 bg-rose-50/40">
        <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 mb-3">Histological Subtype</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div className="border border-rose-200 bg-white rounded p-3">
            <p className="text-[10px] font-bold uppercase text-rose-500 mb-1">Predicted Subclass</p>
            <p className="font-semibold text-gray-800">{fields.subclassLabel}</p>
          </div>
          <div className="border border-rose-200 bg-white rounded p-3">
            <p className="text-[10px] font-bold uppercase text-rose-500 mb-1">Class ID</p>
            <p className="font-semibold text-gray-800">{prediction.class_id != null ? String(prediction.class_id) : 'N/A'}</p>
          </div>
          <div className="border border-rose-200 bg-white rounded p-3">
            <p className="text-[10px] font-bold uppercase text-rose-500 mb-1">Subclass Confidence</p>
            <p className="font-semibold text-gray-800">{subclassConf}</p>
          </div>
          <div className="border border-rose-200 bg-white rounded p-3">
            <p className="text-[10px] font-bold uppercase text-rose-500 mb-1">Diagnosis Confidence</p>
            <p className="font-semibold text-gray-800">{diagConf}</p>
          </div>
        </div>
      </div>

      {/* ══ CLINICAL SECTIONS ══ */}
      <div className="mx-5 mt-4 mb-5 text-[12.5px] text-gray-800">

        {[
          { label: 'Clinical History', content: <span className="leading-[1.9]">{clinicalHistory}</span> },
          { label: 'Sites', content: <span className="leading-[1.9]">Breast core biopsies — histopathology image submitted for AI multi-class subtype classification.</span> },
          {
            label: 'Gross',
            content: <span className="leading-[1.9]">Scanned histological image ({file.size}). Submitted for multi-class inference using the OncoScanAI Master model. Predicted subclass: <strong>{fields.subclassLabel}</strong> (Class ID: {prediction.class_id ?? 'N/A'}). Diagnosis mapping: <strong>{fields.diagnosis}</strong>.</span>,
          },
          { label: 'Microscopic', content: <span className="leading-[1.9]">{microscopic}</span> },
          { label: 'Impression',  content: <span className="leading-[1.9]">{impression}</span> },
          { label: 'Management Considerations', content: <span className="leading-[1.9]">{management}</span> },
          { label: 'Limitations', content: <span className="leading-[1.9]">{limitations}</span> },
          { label: 'Previous BX / AI History', content: <span className="leading-[1.9]">No prior AI scan history available for this session.</span> },
        ].map((section, i) => (
          <div key={i} className={`py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <span className="font-serif font-bold text-[12px] uppercase tracking-widest text-gray-700">{section.label}: </span>
            {section.content}
          </div>
        ))}

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

/* ─────────────────────────────────────────────────────────
   Main page component
   ───────────────────────────────────────────────────────── */
const MultiClassHistoAnalysis: React.FC = () => {
  const [files, setFiles]           = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFile = (id: string, fn: (f: UploadedFile) => UploadedFile) => {
    setFiles(cur => cur.map(f => f.id === id ? fn(f) : f));
    setSelectedFile(prev => prev?.id === id ? fn(prev) : prev);
  };

  /* NLP enrichment via Cloudflare Worker */
  const enrichReport = async (fileObj: UploadedFile, prediction: HistoPrediction) => {
    const fields = getPredictionFields(prediction);
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(REPORT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fileName: fileObj.name,
          analysis: {
            modality: 'histopathology',
            pathology: fields.diagnosis,
            subclass: fields.subclassLabel,
            confidence: prediction.confidence,
            classId: prediction.class_id,
            diagnosisConfidence: prediction.pathology_confidence,
            insight: prediction.insight,
            modelUsed: 'OncoScanAI Master',
          },
        }),
      });
      clearTimeout(timeoutId);
      if (!res.ok) return;

      const json = await res.json() as WorkerReportResponse;
      let structuredReport: StructuredReport | null = null;

      if (json.sections && Array.isArray(json.sections)) {
        structuredReport = { patientInfo: json.patientInfo, sections: json.sections as StructuredReport['sections'] };
      } else if (json.report && typeof json.report === 'string') {
        try {
          const m = json.report.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]) as { sections?: unknown[] };
            if (parsed.sections) structuredReport = parsed as StructuredReport;
          }
        } catch { /* ignore */ }
      }

      if (structuredReport)
        updateFile(fileObj.id, f => ({ ...f, structuredReport, reportStatus: 'Complete' }));
    } catch {
      clearTimeout(timeoutId);
      /* worker offline / timed out — report renders from inference data */
    }
    updateFile(fileObj.id, f => f.reportStatus === 'Generating' ? { ...f, reportStatus: 'Complete' } : f);
  };

  const handleFiles = async (newFiles: File[]) => {
    const uploads: UploadedFile[] = newFiles.map((file, i) => ({
      id: String(Date.now() + i),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      status: 'Uploading',
      type: (file.name.split('.').pop()?.toLowerCase() ?? 'unknown'),
      progress: 0,
      previewUrl: URL.createObjectURL(file),
      reportStatus: 'Idle',
    }));

    setFiles(prev => [...uploads, ...prev]);
    if (uploads.length > 0) setSelectedFile(uploads[0]);

    for (const upload of uploads) {
      const rawFile = newFiles.find(f => f.name === upload.name);
      if (!rawFile) continue;

      const formData = new FormData();
      formData.append('file', rawFile);

      try {
        const response = await fetch('/predict/histo/master', { method: 'POST', body: formData });

        if (!response.ok) {
          const err = await response.json().catch((): ErrorResponse => ({ detail: `Inference failed: ${response.statusText}` })) as ErrorResponse;
          throw new Error(err.detail || 'Analysis failed');
        }

        const result = await response.json() as HistoPrediction;

        // Mark complete immediately so report renders without waiting for worker
        const completed: UploadedFile = {
          ...upload,
          status: 'Complete',
          progress: 100,
          prediction: result,
          reportStatus: 'Generating',
        };
        updateFile(upload.id, () => completed);

        // Kick off NLP enrichment in background
        enrichReport(completed, result);

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Neural link failure.';
        updateFile(upload.id, f => ({ ...f, status: 'Failed', progress: 100, errorMessage: msg }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
  };

  const selectedPrediction = selectedFile?.prediction;
  const selectedFields     = getPredictionFields(selectedPrediction);

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* ══ TOP: Upload + queue ══ */}
      <div className="relative rounded-2xl shadow-subtle border border-gray-200 overflow-hidden">
        <div className="absolute inset-0 dot-grid-bg opacity-40 pointer-events-none" />
        <div className="relative bg-white/80 backdrop-blur-sm p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Drop zone — animated gradient border when idle */}
          <div
            onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className={`rounded-xl flex items-center gap-4 px-6 py-8 transition-all cursor-pointer ${isDragging ? 'bg-pink-50 scale-[1.02]' : 'upload-zone-idle bg-white/70'}`}
          >
            <input type="file" id="histo-file-upload" className="hidden" multiple accept=".png,.jpg,.jpeg,.svs,.tiff"
              onChange={e => e.target.files && handleFiles(Array.from(e.target.files))} />
            <label htmlFor="histo-file-upload" className="flex items-center gap-4 cursor-pointer w-full">
              {/* Live preview thumbnail */}
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
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, TIFF, SVS · OncoScanAI Master Model</p>
              </div>
            </label>
          </div>

          {/* Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan Queue</p>
              <span className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{files.length} Files</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {files.length === 0
                ? <p className="text-[10px] text-slate-400 text-center py-2">No scans uploaded yet</p>
                : files.map(file => {
                    const f = getPredictionFields(file.prediction);
                    return (
                      <button key={file.id} onClick={() => setSelectedFile(file)}
                        className={`w-full flex items-center p-1.5 rounded-lg transition-colors ${selectedFile?.id === file.id ? 'bg-pink-50' : 'hover:bg-gray-50'}`}>
                        {file.previewUrl
                          ? <img src={file.previewUrl} alt={file.name} className="w-7 h-7 rounded-md object-cover mr-2" />
                          : <div className="w-7 h-7 rounded-md bg-gray-100 mr-2" />}
                        <p className="text-[10px] font-bold text-brand-text-primary truncate flex-grow text-left">{file.name}</p>
                        {file.status === 'Uploading' && <div className="w-3 h-3 border-2 border-brand-pink border-t-transparent rounded-full animate-spin ml-1" />}
                        {file.status === 'Complete' && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${getDiagnosisBadgeClass(f.diagnosis)}`}>{f.diagnosis.toUpperCase()}</span>}
                        {file.status === 'Failed' && <span className="text-[9px] font-bold text-red-500 ml-1">Failed</span>}
                      </button>
                    );
                  })
              }
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ══ GRADIENT SEPARATOR ══ */}
      <hr className="gradient-separator" />

      {/* ══ BOTTOM: Report (left) + Model Results (right) ══ */}
      <div className="flex-1 min-h-0">
        <div className="h-full">
          {selectedFile && selectedFile.status === 'Complete' && selectedPrediction ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 h-full">

              {/* LEFT — Model Results */}
              <div className="overflow-y-auto flex flex-col gap-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Model Results</h3>

                {/* Scan image */}
                <div className="bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '200px' }}>
                  {selectedFile.previewUrl
                    ? <img src={selectedFile.previewUrl} alt={selectedFile.name} className="max-w-full object-contain" style={{ maxHeight: '240px' }} />
                    : <div className="text-gray-400 text-sm">Preview unavailable</div>}
                </div>

                {/* Diagnosis + subclass */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-brand-text-secondary uppercase mb-1">Diagnosis</p>
                      <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${getDiagnosisBadgeClass(selectedFields.diagnosis)}`}>
                        {selectedFields.diagnosis.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-brand-text-secondary uppercase mb-1">Subclass</p>
                      <span className="inline-flex px-3 py-1.5 rounded-full text-sm font-bold bg-gray-100 text-gray-800 border border-gray-200">
                        {getPredictionFields(selectedPrediction).subclassLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-brand-text-secondary leading-5 italic">
                    {selectedPrediction.insight || 'The master model completed subclass prediction and diagnosis mapping.'}
                  </p>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Subclass Conf.', value: `${(selectedPrediction.confidence * 100).toFixed(1)}%` },
                    { label: 'Diagnosis Conf.', value: selectedPrediction.pathology_confidence != null ? `${(selectedPrediction.pathology_confidence * 100).toFixed(1)}%` : 'N/A' },
                    { label: 'Class ID', value: selectedPrediction.class_id != null ? String(selectedPrediction.class_id) : 'N/A' },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-[9px] text-brand-text-secondary font-semibold uppercase">{c.label}</p>
                      <p className="text-lg font-black text-brand-text-primary mt-0.5">{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Engine badge */}
                <div className="flex items-center gap-2 text-[10px] text-brand-text-secondary">
                  <ModelIcon className="w-3.5 h-3.5" />
                  <span className="font-bold">ONCOSCANAI MASTER</span>
                  <span className="text-green-600 font-bold flex items-center gap-1"><LiveIcon className="w-3 h-3" /> LIVE</span>
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
                    <button onClick={() => enrichReport(selectedFile, selectedPrediction)}
                      disabled={selectedFile.reportStatus === 'Generating'}
                      className="px-3 py-1.5 bg-brand-pink text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-pink-dark disabled:opacity-50 transition-all">
                      Regenerate
                    </button>
                    <button onClick={() => downloadReportAsPDF('pathology-report-multi', `MultiHisto-Report-${selectedFile.name.replace(/\.[^/.]+$/, '')}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#1e40af] transition-all">
                      <DownloadIcon className="w-3 h-3" />
                      Download PDF
                    </button>
                  </div>
                </div>
                <MultiPathologyReport file={selectedFile} prediction={selectedPrediction} />
              </div>
            </div>
          ) : selectedFile && selectedFile.status === 'Failed' ? (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-gray-200">
              <InfoIcon className="w-8 h-8 text-red-500 mb-3" />
              <h3 className="text-base font-semibold text-red-700">Analysis Failed</h3>
              <p className="text-sm text-brand-text-secondary mt-1 max-w-sm">{selectedFile.errorMessage}</p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-gray-200">
              <div className="w-10 h-10 border-2 border-brand-pink border-t-transparent rounded-full animate-spin mb-3" />
              <h3 className="text-base font-semibold text-brand-text-primary">Processing Scan…</h3>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <VisionIcon className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Upload a scan above to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiClassHistoAnalysis;
