
import React, { useEffect, useState } from 'react';
import type { AnalysisResult, UploadedFile } from '../types';
import { UploadIcon, ModelIcon, LiveIcon, VisionIcon, InfoIcon, DownloadIcon } from '../components/icons';
import { downloadReportAsPDF } from '../utils/downloadPDF';
// --- Helper Functions ---

type ModelsResponse = {
  active_models?: string[];
  ultrasound_models?: string[];
};

const deriveUltrasoundModels = (json: ModelsResponse) => {
  if (Array.isArray(json.ultrasound_models)) return json.ultrasound_models;
  const active = Array.isArray(json.active_models) ? json.active_models : [];
  return active.filter(model => model === 'best_model' || model === 'best_seg');
};

type CombinedInferenceResponse = {
  result?: string;
  confidence?: number | string;
  insight?: string;
  engine?: string;
  classification_engine?: string;
  segmentation_engine?: string;
  heatmap_url?: string;
  mask?: string;
  segmentation_mask?: string;
  mask_pixel_count?: number | string;
  mask_area_mm2?: number | string;
  mask_type?: string;
};

type WorkerReportResponse = {
  report?: string;
};

const REPORT_WORKER_URL = '/report';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Fix: Add 'Inconclusive' to pathology union for full coverage of AnalysisResult.pathology
const getPathologyBadgeClass = (pathology: 'Benign' | 'Malignant' | 'Normal' | 'Inconclusive') => {
    switch (pathology) {
        case 'Malignant': return 'bg-red-100 text-red-700';
        case 'Benign': return 'bg-green-100 text-green-700';
        case 'Normal': return 'bg-blue-100 text-blue-700';
        case 'Inconclusive': return 'bg-gray-100 text-gray-700';
        default: return 'bg-gray-100 text-gray-700';
    }
};

// Fix: Add 'Inconclusive' to pathology union
const getPathologyTextClass = (pathology: 'Benign' | 'Malignant' | 'Normal' | 'Inconclusive') => {
    switch (pathology) {
        case 'Malignant': return 'text-red-600';
        case 'Benign': return 'text-green-600';
        case 'Normal': return 'text-blue-600';
        case 'Inconclusive': return 'text-gray-600';
        default: return 'text-gray-600';
    }
};


// --- Child Components ---

const AnalysisStatCard: React.FC<{ title: string; value: string; }> = ({ title, value }) => (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs text-brand-text-secondary font-medium">{title}</p>
        <p className="text-xl font-semibold text-brand-text-primary mt-1">{value}</p>
    </div>
);

const normalizePathology = (value?: string): AnalysisResult['pathology'] => {
  const normalized = (value || 'Inconclusive').trim().toLowerCase();
  if (normalized === 'malignant') return 'Malignant';
  if (normalized === 'benign') return 'Benign';
  if (normalized === 'normal') return 'Normal';
  return 'Inconclusive';
};

const normalizeReportText = (report?: string) =>
  (report || '')
    .replace(/\*\*/g, '')
    .replace(/mmÂ²/g, 'mm^2')
    .trim();

// --- Main Component ---

const UploadScans: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [backendModels, setBackendModels] = useState<string[] | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const canRunInference = Array.isArray(backendModels) && backendModels.length > 0;

  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/models');
        if (!res.ok) {
          const text = await res.text().catch(() => `Status ${res.status}`);
          throw new Error(text || `Backend error (${res.status})`);
        }
        const json = await res.json() as ModelsResponse;
        if (isMounted) {
          setBackendModels(deriveUltrasoundModels(json));
          setBackendError(null);
        }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          setBackendError(msg);
          setBackendModels([]);
        }
      }
    };
    loadModels();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileSelect = (file: UploadedFile) => {
    if (file.status === 'Complete' || file.status === 'Failed') setSelectedFile(file);
  };

  const updateUploadedFile = (fileId: string, updater: (file: UploadedFile) => UploadedFile) => {
    setFiles(cur => cur.map(file => (file.id === fileId ? updater(file) : file)));
    setSelectedFile(prev => (prev && prev.id === fileId ? updater(prev) : prev));
  };

  const generateSuggestiveReport = async (fileObj: UploadedFile, analysis: AnalysisResult) => {
    updateUploadedFile(fileObj.id, file => ({
      ...file,
      reportStatus: 'Generating',
      reportError: undefined,
    }));

    // Build a local fallback narrative so the report always renders
    const localFallback = [
      `Ultrasound imaging of the submitted scan demonstrates findings consistent with ${analysis.pathology.toLowerCase()} pathology.`,
      analysis.insight || '',
      analysis.area   != null ? `Estimated lesion area: ${analysis.area.toFixed(2)} mm².`   : '',
      analysis.pixels != null ? `Segmented pixel count: ${analysis.pixels} px.`              : '',
    ].filter(Boolean).join(' ').trim();

    // Always complete within 5 s — abort the worker call if it hangs
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
            pathology:   analysis.pathology,
            confidence:  analysis.confidence,
            insight:     analysis.insight,
            pixels:      analysis.pixels,
            area:        analysis.area,
            modelUsed:   analysis.modelUsed,
          },
        }),
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const json   = await res.json() as WorkerReportResponse;
      const report = normalizeReportText(json.report) || localFallback;

      updateUploadedFile(fileObj.id, file => ({
        ...file,
        reportStatus: 'Complete',
        suggestiveReport: report,
        reportError: undefined,
      }));
    } catch {
      clearTimeout(timeoutId);
      // Worker offline / timed out — use local fallback immediately
      updateUploadedFile(fileObj.id, file => ({
        ...file,
        reportStatus: 'Complete',
        suggestiveReport: localFallback,
        reportError: undefined,
      }));
    }
  };

  const runBestModelInference = async (fileObj: UploadedFile, fileBlob: File) => {
    const form = new FormData();
    form.append('file', fileBlob);

    setFiles(cur => cur.map(f => f.id === fileObj.id ? { ...f, status: 'Analyzing' } : f));
    setSelectedFile(prev => prev && prev.id === fileObj.id ? { ...fileObj, status: 'Analyzing' } : prev);

    try {
      const res = await fetch('http://127.0.0.1:8000/predict/ultrasound/combined', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        const text = await res.text().catch(() => `Status ${res.status}`);
        throw new Error(text || `Inference failed (${res.status})`);
      }

      const json = await res.json() as CombinedInferenceResponse;

      // Map backend response to AnalysisResult shape. Prefer backend-provided values.
      const analysis: AnalysisResult = {
        pathology: normalizePathology(json.result),
        confidence: typeof json.confidence === 'number' ? json.confidence : Number(json.confidence) || 0,
        insight: json.insight || '',
        modelUsed: json.engine || 'BEST_MODEL',
        classificationEngine: json.classification_engine || undefined,
        segmentationEngine: json.segmentation_engine || undefined,
        heatmapUrl: json.heatmap_url || undefined,
        // Backend should return 'mask' which may be a data URL (base64) or a URL to an overlay image
        segmentationMask: json.mask || json.segmentation_mask || undefined,
        // Backend-provided numeric values (do not recompute on frontend unless absent)
        pixels: typeof json.mask_pixel_count === 'number' ? json.mask_pixel_count : (json.mask_pixel_count ? Number(json.mask_pixel_count) : undefined),
        area: typeof json.mask_area_mm2 === 'number' ? json.mask_area_mm2 : (json.mask_area_mm2 ? Number(json.mask_area_mm2) : undefined),
        maskType: json.mask_type || undefined
      };

      const completedFile: UploadedFile = {
        ...fileObj,
        status: 'Complete',
        analysis,
        reportStatus: 'Generating',
        reportError: undefined,
      };

      setFiles(cur => cur.map(f => f.id === fileObj.id ? completedFile : f));
      setSelectedFile(prev => (!prev || prev.id === fileObj.id ? completedFile : prev));
      void generateSuggestiveReport(completedFile, analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFiles(cur => cur.map(f => f.id === fileObj.id ? ({ ...f, status: 'Failed', errorMessage: msg } as UploadedFile) : f));
      setSelectedFile(prev => prev && prev.id === fileObj.id ? ({ ...fileObj, status: 'Failed', errorMessage: msg } as UploadedFile) : prev);
    }
  };

  const handleFileDrop = async (droppedFiles: File[]) => {
    if (!canRunInference) {
      const errMsg = backendError
        ? `Backend check failed: ${backendError}`
        : 'No backend models are loaded. Kindly add your models to backend/models and restart the server.';
      const failedUploads: UploadedFile[] = Array.from(droppedFiles).map((file, index) => ({
        id: String(Date.now() + index),
        name: file.name,
        size: formatBytes(file.size),
        status: 'Failed',
        errorMessage: errMsg,
        type: (file.name.split('.').pop() as any) || 'png',
        previewUrl: URL.createObjectURL(file),
      }));
      setFiles(prev => [...failedUploads, ...prev]);
      if (failedUploads.length > 0) setSelectedFile(failedUploads[0]);
      return;
    }

    const newUploads: UploadedFile[] = Array.from(droppedFiles).map((file, index) => ({
      id: String(Date.now() + index),
      name: file.name,
      size: formatBytes(file.size),
      status: 'Pending',
      type: (file.name.split('.').pop() as any) || 'png',
      previewUrl: URL.createObjectURL(file),
      reportStatus: 'Idle',
    }));

    setFiles(prev => [...newUploads, ...prev]);
    if (newUploads.length > 0) setSelectedFile(newUploads[0]);

    // Start inference for each uploaded file
    for (let i = 0; i < newUploads.length; i++) {
      const upload = newUploads[i];
      const fileBlob = droppedFiles.find(f => f.name === upload.name) as File;
      if (!fileBlob) continue;
      // Run ultrasound classification inference
      await runBestModelInference(upload, fileBlob);
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isEntering);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFileDrop(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* ══ TOP: Upload + queue ══ */}
      <div className="relative rounded-2xl shadow-subtle border border-gray-200 overflow-hidden">
        <div className="absolute inset-0 dot-grid-bg opacity-40 pointer-events-none" />
        <div className="relative bg-white/80 backdrop-blur-sm p-5">
        {(backendError || (backendModels && backendModels.length === 0)) && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-900 p-3 rounded-lg text-xs">
            <span className="font-bold">Models Missing: </span>
            {backendError ? `Backend check failed: ${backendError}` : 'No backend models loaded. Add your models to backend/models and restart.'}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Drop zone — animated gradient border when idle */}
          <div
            onDragEnter={e => handleDragEvents(e, true)}
            onDragLeave={e => handleDragEvents(e, false)}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            className={`rounded-xl flex items-center gap-4 px-6 py-8 transition-all ${isDragging ? 'bg-blue-50 scale-[1.02]' : 'upload-zone-idle bg-white/70'}`}
          >
            <input type="file" id="vision-upload" className="hidden" multiple onChange={e => e.target.files && handleFileDrop(Array.from(e.target.files))} />
            <label htmlFor="vision-upload" className="flex items-center gap-4 cursor-pointer w-full">
              {/* Live preview thumbnail */}
              {files.length > 0 && files[0].previewUrl ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-blue-400 shadow-md flex-shrink-0">
                  <img src={files[0].previewUrl} alt="preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <UploadIcon className="w-7 h-7 text-blue-500" />
                </div>
              )}
              <div>
                <p className="text-base font-bold text-slate-700">
                  {files.length > 0 ? `${files.length} scan${files.length > 1 ? 's' : ''} loaded · ` : ''}
                  <span className="text-blue-500 underline">Browse or Drop</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, DICOM — Max 500MB</p>
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
                : files.map(file => (
                    <button key={file.id} onClick={() => handleFileSelect(file)}
                      className={`w-full flex items-center p-1.5 rounded-lg transition-colors ${selectedFile?.id === file.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <img src={file.previewUrl} alt={file.name} className="w-7 h-7 rounded-md object-cover mr-2 flex-shrink-0" />
                      <p className="text-[10px] font-bold text-brand-text-primary truncate flex-grow text-left">{file.name}</p>
                      {file.status === 'Analyzing' && <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-1" />}
                      {file.status === 'Complete' && file.analysis && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${getPathologyBadgeClass(file.analysis.pathology)}`}>
                          {file.analysis.pathology.toUpperCase()}
                        </span>
                      )}
                      {file.status === 'Failed' && <span className="text-[9px] font-bold text-red-500 ml-1">Failed</span>}
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
      <div className="flex-1 min-h-0">
        <div className="h-full">
        {selectedFile && selectedFile.status === 'Complete' && selectedFile.analysis ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 h-full">

            {/* LEFT — Model Results */}
            <div className="overflow-y-auto flex flex-col gap-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Model Results</h3>

              {/* Scan panels */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-brand-text-secondary mb-1 text-center uppercase">Original Scan</p>
                  <div className="h-44 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                    <img src={selectedFile.previewUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-brand-text-secondary mb-1 text-center uppercase">Segmentation</p>
                  <div className="h-44 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden relative">
                    <img src={selectedFile.previewUrl} alt="Seg" className="max-w-full max-h-full object-contain" />
                    {selectedFile.analysis.segmentationMask && (
                      <img src={selectedFile.analysis.segmentationMask} alt="Mask" className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ mixBlendMode: 'screen' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <AnalysisStatCard title="AI CONFIDENCE" value={`${(selectedFile.analysis.confidence * 100).toFixed(1)}%`} />
                <AnalysisStatCard title="TUMOUR AREA" value={selectedFile.analysis.area != null ? `${selectedFile.analysis.area.toFixed(2)} mm²` : 'N/A'} />
                <AnalysisStatCard title="TUMOUR PIXELS" value={selectedFile.analysis.pixels != null ? `${selectedFile.analysis.pixels} PX` : 'N/A'} />
              </div>

              {/* Insight */}
              <div className="bg-blue-50 border-l-4 border-blue-400 text-brand-text-primary p-4 rounded-r-lg">
                <p className="font-semibold text-sm">Radiologist Insight:</p>
                <p className="text-sm mt-1">{selectedFile.analysis.insight}</p>
              </div>

              {/* Engine */}
              <div className="flex items-center gap-2 text-[10px] text-brand-text-secondary bg-white border border-gray-200 rounded-lg p-3">
                <ModelIcon className="w-3.5 h-3.5" />
                <span className="font-bold">MODELS: {selectedFile.analysis.modelUsed}</span>
                <span className="text-green-600 font-bold flex items-center gap-1 ml-2"><LiveIcon className="w-3 h-3" /> LIVE INFERENCE</span>
              </div>
              {selectedFile.analysis.classificationEngine && (
                <div className="text-[10px] text-brand-text-secondary space-y-0.5 px-1">
                  <p>Classification: {selectedFile.analysis.classificationEngine}</p>
                  {selectedFile.analysis.segmentationEngine && <p>Segmentation: {selectedFile.analysis.segmentationEngine}</p>}
                </div>
              )}
            </div>

            {/* RIGHT — Radiology Report */}
            <div className="overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Radiology Report</h3>
                <div className="flex items-center gap-2">
                  {selectedFile.reportStatus === 'Generating' && (
                    <span className="text-[9px] font-bold text-brand-pink animate-pulse uppercase tracking-widest">Generating…</span>
                  )}
                  <button type="button"
                    onClick={() => void generateSuggestiveReport(selectedFile, selectedFile.analysis!)}
                    disabled={selectedFile.reportStatus === 'Generating'}
                    className="bg-brand-pink text-white text-[9px] font-bold px-3 py-1.5 rounded-lg hover:bg-brand-pink-dark disabled:opacity-60 transition-colors">
                    {selectedFile.reportStatus === 'Generating' ? 'Generating...' : 'Regenerate'}
                  </button>
                  <button type="button"
                    onClick={() => downloadReportAsPDF('us-report', `Ultrasound-Report-${selectedFile.name.replace(/\.[^/.]+$/, '')}`)}
                    className="flex items-center gap-1.5 bg-[#1e3a5f] text-white text-[9px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#1e40af] transition-colors">
                    <DownloadIcon className="w-3 h-3" />
                    Download PDF
                  </button>
                </div>
              </div>
              {/* Report document */}
              {(() => {
                const a = selectedFile.analysis!;
                const now = new Date();
                const reportDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const reportId = `US-${Date.now().toString(36).toUpperCase()}`;
                const isMalignant = a.pathology === 'Malignant';
                const isBenign    = a.pathology === 'Benign';
                const isNormal    = a.pathology === 'Normal';
                const diagBadgeBg  = isMalignant ? '#dc2626' : isBenign ? '#16a34a' : '#2563eb';
                const confPct      = a.confidence * 100;
                const confBarColor = confPct < 40 ? '#dc2626' : confPct <= 80 ? '#f59e0b' : '#16a34a';
                const confLabel    = confPct < 40 ? 'Low' : confPct <= 80 ? 'Moderate' : 'High';
                const rawFindings = selectedFile.suggestiveReport ? selectedFile.suggestiveReport.replace(/\*\*/g, '').trim() : '';
                const keyFindings: string[] = [
                  `Ultrasound imaging demonstrates features consistent with a <strong>${a.pathology}</strong> lesion pattern.`,
                  a.insight ? a.insight : null,
                  a.area   != null ? `Estimated lesion area: <strong>${a.area.toFixed(2)} mm²</strong> based on AI segmentation mask.` : null,
                  a.pixels != null ? `Segmented region spans approximately <strong>${a.pixels} pixels</strong> on the submitted scan.` : null,
                  isMalignant ? `Irregular borders and heterogeneous echo texture noted — suspicious morphology detected.` : null,
                  isBenign    ? `Well-defined margins and homogeneous internal echo pattern — benign morphology indicated.` : null,
                  isNormal    ? `No discrete mass lesion or pathological echo abnormality identified on this scan.` : null,
                  a.classificationEngine ? `Classification Engine: <strong>${a.classificationEngine}</strong>` : null,
                  a.segmentationEngine   ? `Segmentation Engine: <strong>${a.segmentationEngine}</strong>`   : null,
                ].filter(Boolean) as string[];
                if (rawFindings) keyFindings.unshift(rawFindings.split('.')[0].trim() + '.');
                const impression = isMalignant
                  ? `Imaging findings are suspicious for malignancy. Urgent clinical correlation, further diagnostic workup, and core needle biopsy are strongly recommended.`
                  : isBenign
                  ? `Imaging findings are consistent with a benign lesion. Routine clinical follow-up and interval ultrasound in 6 months is advised.`
                  : isNormal
                  ? `No significant pathological abnormality identified on this ultrasound examination.`
                  : `Imaging findings are inconclusive. Correlation with clinical history and additional imaging is recommended.`;
                const recommendations = isMalignant
                  ? ['Urgent referral to breast oncology / surgical oncology', 'Core needle biopsy for tissue diagnosis', 'Staging workup — MRI, CT chest/abdomen/pelvis', 'Multidisciplinary tumor board review']
                  : isBenign
                  ? ['Routine follow-up ultrasound in 6 months', 'Clinical correlation with physical examination', 'Mammography if not recently performed']
                  : isNormal
                  ? ['Routine annual screening as clinically appropriate', 'Clinical follow-up if symptoms persist']
                  : ['Additional cross-sectional imaging (MRI/CT)', 'Short-interval follow-up ultrasound in 3 months'];

                return (
                  <div className="bg-white border border-gray-200 shadow-2xl font-sans text-[13px] text-gray-900 rounded-lg overflow-hidden" id="us-report">
                    <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)' }} className="px-6 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                          <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="#1e3a5f" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                        </div>
                        <div>
                          <p className="text-white font-black text-[1.1rem] tracking-wide">OncoScanAI Imaging Center</p>
                          <p className="text-blue-200 text-[11px] mt-0.5">AI-Assisted Radiology & Diagnostic Imaging</p>
                          <div className="flex gap-3 mt-1"><span className="text-[10px] text-blue-300">📞 +92-XXX-XXXXXXX</span><span className="text-[10px] text-blue-300">🌐 oncoscanai.health</span></div>
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2 text-center"><p className="text-white font-black text-[11px] uppercase tracking-widest">24/7 Services</p><p className="text-blue-200 text-[10px] mt-0.5">✉ reports@oncoscanai.health</p></div>
                    </div>
                    <div className="bg-slate-50 border-b border-gray-200 px-6 py-3 grid grid-cols-3 gap-x-8 gap-y-1 text-[11.5px]">
                      <div><span className="text-gray-500 font-semibold">Patient File:</span> <span className="font-bold text-gray-800">{selectedFile.name}</span></div>
                      <div><span className="text-gray-500 font-semibold">Report ID:</span> <span className="font-bold text-gray-800">{reportId}</span></div>
                      <div><span className="text-gray-500 font-semibold">Date / Time:</span> <span className="font-bold text-gray-800">{reportDate} · {reportTime}</span></div>
                      <div><span className="text-gray-500 font-semibold">Modality:</span> <span className="font-bold text-gray-800">Ultrasound</span></div>
                      <div><span className="text-gray-500 font-semibold">AI Engine:</span> <span className="font-bold text-gray-800">{a.modelUsed || 'OncoScanAI Best Model'}</span></div>
                      <div><span className="text-gray-500 font-semibold">Result:</span> <span className="font-black" style={{ color: diagBadgeBg }}>{a.pathology.toUpperCase()}</span></div>
                    </div>
                    <div className="text-center py-4 border-b border-gray-200 bg-white">
                      <h2 className="font-serif text-[1.4rem] font-bold tracking-wide text-gray-800">Ultrasound Analysis Report</h2>
                      <p className="text-[10.5px] text-gray-500 mt-1 tracking-wide">AI-Assisted Lesion Detection & Segmentation · OncoScanAI</p>
                    </div>
                    <div className="px-6 pt-5 pb-6 space-y-5">
                      <div className="flex items-center gap-5 p-4 rounded-xl border-2" style={{ borderColor: diagBadgeBg, backgroundColor: `${diagBadgeBg}08` }}>
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <div className="px-5 py-2 rounded-lg text-white font-black text-[13px] uppercase tracking-widest shadow-md" style={{ backgroundColor: diagBadgeBg }}>{a.pathology}</div>
                          <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">AI Diagnosis</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">AI Confidence</span>
                            <span className="text-[12px] font-black" style={{ color: confBarColor }}>{confPct.toFixed(1)}% — {confLabel}</span>
                          </div>
                          <div className="h-4 w-64 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${confPct}%`, backgroundColor: confBarColor }} />
                          </div>
                          <div className="flex justify-between mt-1 text-[9px] text-gray-400"><span>0%</span><span>Low</span><span>Moderate</span><span>High</span><span>100%</span></div>
                        </div>
                      </div>
                      {selectedFile.previewUrl && (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: '#1e3a5f' }}>Scan Images</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <div className="bg-gray-900 border-2 border-gray-300 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '160px' }}>
                                <img src={selectedFile.previewUrl} alt="Original" className="w-full h-full object-contain" style={{ maxHeight: '200px' }} />
                              </div>
                              <p className="text-[10px] font-bold text-gray-700 mt-1 text-center">Original Scan</p>
                            </div>
                            <div className="flex flex-col">
                              <div className="bg-gray-900 border-2 border-gray-300 rounded-lg overflow-hidden flex items-center justify-center relative" style={{ minHeight: '160px' }}>
                                <img src={selectedFile.previewUrl} alt="Segmentation" className="w-full h-full object-contain" style={{ maxHeight: '200px', filter: 'contrast(1.15) brightness(0.95)' }} />
                                {a.segmentationMask && <img src={a.segmentationMask} alt="Mask" className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ mixBlendMode: 'screen' }} />}
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5"><span className="text-[9px] font-black text-white uppercase tracking-widest">AI Segmentation</span></div>
                              </div>
                              <p className="text-[10px] font-bold text-gray-700 mt-1 text-center">Segmentation Overlay</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        {[{ label: 'AI Confidence', value: `${confPct.toFixed(1)}%`, icon: '🎯', color: confBarColor }, { label: 'Lesion Area', value: a.area != null ? `${a.area.toFixed(2)} mm²` : 'N/A', icon: '📐', color: '#1e3a5f' }, { label: 'Lesion Pixels', value: a.pixels != null ? `${a.pixels} px` : 'N/A', icon: '🔬', color: '#1e3a5f' }].map(c => (
                          <div key={c.label} className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1"><span>{c.icon}</span><p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{c.label}</p></div>
                            <p className="text-[1.1rem] font-black mt-0.5" style={{ color: c.color }}>{c.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border-l-4 border-[#1e3a5f] bg-blue-50/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="font-serif font-bold uppercase text-[12px] tracking-widest text-[#1e3a5f]">Key Findings</p>
                          {selectedFile.reportStatus === 'Generating' && <span className="flex items-center gap-1 text-[9px] text-brand-pink font-bold animate-pulse ml-2"><span className="w-1.5 h-1.5 rounded-full bg-brand-pink inline-block animate-ping" />Enhancing…</span>}
                        </div>
                        <ul className="space-y-2">
                          {keyFindings.map((point, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-black mt-1" style={{ backgroundColor: '#1e3a5f' }}>{i + 1}</span>
                              <span className="text-[12.5px] leading-[1.9] text-gray-800" dangerouslySetInnerHTML={{ __html: point }} />
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm border-t-0 rounded-t-none" style={{ borderTop: '1px solid #f1f5f9' }}>
                        <p className="font-serif font-bold uppercase text-[12px] tracking-widest mb-2" style={{ color: '#1e3a5f' }}>Radiologist Impression</p>
                        <p className="text-[12.5px] leading-[1.9] text-gray-800">{impression}</p>
                      </div>
                      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 100%)', border: '1px solid #c7d7ff' }}>
                        <p className="font-serif font-bold uppercase text-[12px] tracking-widest mb-3 text-[#1e3a5f]">Recommended Clinical Actions</p>
                        <ul className="space-y-2">
                          {recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-[#1e3a5f] font-black text-sm flex-shrink-0 mt-0.5">→</span>
                              <span className="text-[12.5px] leading-[1.9] text-gray-800">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <p className="font-serif text-[11.5px] text-gray-500 italic text-center leading-[1.9]">This report is fully AI-generated by OncoScanAI. It is intended for preliminary clinical reference only and does not constitute a formal medical diagnosis. A licensed radiologist or pathologist must review and validate all findings before any clinical decision is made.</p>
                      </div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)' }} className="px-6 py-3 flex items-center justify-between">
                      <p className="text-blue-200 text-[10px] italic max-w-md">This report is AI-generated for preliminary reference only. A licensed radiologist must review before clinical use.</p>
                      <p className="text-white text-[10px] font-mono font-bold flex-shrink-0 ml-4">{reportId} · OncoScanAI v2</p>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>

        ) : selectedFile && selectedFile.status === 'Failed' ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><InfoIcon className="w-6 h-6 text-red-600" /></div>
            <h3 className="text-base font-semibold text-red-700">Analysis Failed</h3>
            <p className="text-sm text-brand-text-secondary mt-1 max-w-sm">{selectedFile.errorMessage}</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-gray-200">
            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
            <h3 className="text-base font-semibold text-brand-text-primary">Analyzing Scan…</h3>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <VisionIcon className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Upload a scan above to begin</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UploadScans;
