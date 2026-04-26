import React from 'react';
import type { HistoPrediction, PatientRecord, StructuredReport } from '../types';

const formatReportDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

const formatReportTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const titleCase = (value?: string) =>
  (value || '')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const splitSteps = (value: string) =>
  value.split(/\s(?=\d+\.\s)/).map(step => step.trim()).filter(Boolean);

const getPredictionFields = (prediction?: HistoPrediction) => {
  const subclass = prediction?.subclass_prediction || prediction?.subclass || prediction?.result || 'unknown';
  const diagnosis = prediction?.diagnosis_prediction || prediction?.diagnosis || prediction?.pathology_group || 'unknown';
  return { subclass, subclassLabel: titleCase(subclass), diagnosis: diagnosis.toLowerCase() };
};

const getSectionText = (report: StructuredReport | undefined, title: string) =>
  report?.sections.find(section => section.title === title)?.subsections?.[0]?.content;

const UltrasoundReport: React.FC<{ record: PatientRecord }> = ({ record }) => {
  const analysis = record.analysis;
  if (!analysis) return null;

  const reportDate = formatReportDate(record.updatedAt || record.createdAt);
  const reportTime = formatReportTime(record.updatedAt || record.createdAt);
  const reportId = record.clientRecordId.toUpperCase();
  const isMalignant = analysis.pathology === 'Malignant';
  const isBenign = analysis.pathology === 'Benign';
  const isNormal = analysis.pathology === 'Normal';
  const confidencePercent = analysis.confidence * 100;
  const badgeColor = isMalignant ? '#dc2626' : isBenign ? '#16a34a' : '#2563eb';
  const confidenceColor = confidencePercent < 40 ? '#dc2626' : confidencePercent <= 80 ? '#f59e0b' : '#16a34a';
  const confidenceLabel = confidencePercent < 40 ? 'Low' : confidencePercent <= 80 ? 'Moderate' : 'High';
  const summaryText = (record.suggestiveReport || analysis.insight || '').replace(/\*\*/g, '').trim();
  const keyFindings = [
    summaryText,
    analysis.area != null ? `Estimated lesion area: ${analysis.area.toFixed(2)} mm^2.` : '',
    analysis.pixels != null ? `Segmented region spans approximately ${analysis.pixels} pixels.` : '',
    analysis.classificationEngine ? `Classification engine: ${analysis.classificationEngine}.` : '',
    analysis.segmentationEngine ? `Segmentation engine: ${analysis.segmentationEngine}.` : '',
  ].filter(Boolean);

  const impression = isMalignant
    ? 'Imaging findings are suspicious for malignancy. Urgent clinical correlation and tissue diagnosis are recommended.'
    : isBenign
    ? 'Imaging findings are consistent with a benign lesion pattern. Routine clinical follow-up is advised.'
    : isNormal
    ? 'No significant pathological abnormality is identified on this ultrasound examination.'
    : 'Imaging findings remain indeterminate. Additional clinical correlation is recommended.';

  const recommendations = isMalignant
    ? ['Specialist oncology referral', 'Core needle biopsy for tissue diagnosis', 'Cross-sectional staging workup']
    : isBenign
    ? ['Interval ultrasound follow-up', 'Clinical correlation with examination', 'Mammography if clinically indicated']
    : isNormal
    ? ['Routine screening follow-up', 'Clinical reassessment if symptoms persist']
    : ['Additional imaging workup', 'Short-interval follow-up ultrasound'];

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-subtle">
      <div className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
        <div>
          <p className="text-lg font-black tracking-wide">OncoScanAI Imaging Center</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-300">Ultrasound Analysis Report</p>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-2 text-right">
          <p className="text-[11px] font-black uppercase tracking-[0.18em]">Report ID</p>
          <p className="mt-1 text-sm font-bold">{reportId}</p>
        </div>
      </div>

      <div className="grid gap-3 border-b border-gray-200 bg-slate-50 px-6 py-4 text-[11px] text-slate-600 md:grid-cols-3">
        <p><span className="font-bold text-slate-800">Patient File:</span> {record.fileName}</p>
        <p><span className="font-bold text-slate-800">Date:</span> {reportDate}</p>
        <p><span className="font-bold text-slate-800">Time:</span> {reportTime}</p>
        <p><span className="font-bold text-slate-800">Modality:</span> Ultrasound</p>
        <p><span className="font-bold text-slate-800">AI Engine:</span> {analysis.modelUsed || 'OncoScanAI Best Model'}</p>
        <p><span className="font-bold text-slate-800">Result:</span> <span style={{ color: badgeColor }} className="font-black">{analysis.pathology.toUpperCase()}</span></p>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="rounded-[1.4rem] border-2 p-4" style={{ borderColor: badgeColor, backgroundColor: `${badgeColor}08` }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white" style={{ backgroundColor: badgeColor }}>
                {analysis.pathology}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {summaryText || 'AI-assisted ultrasound analysis completed for this study.'}
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
                <span>AI Confidence</span>
                <span style={{ color: confidenceColor }}>{confidencePercent.toFixed(1)}% {confidenceLabel}</span>
              </div>
              <div className="h-3 rounded-full bg-white shadow-inner">
                <div className="h-full rounded-full" style={{ width: `${confidencePercent}%`, backgroundColor: confidenceColor }} />
              </div>
            </div>
          </div>
        </div>

        {record.previewImage && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Original Scan</p>
              <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-[1.2rem] bg-slate-900">
                <img src={record.previewImage} alt={record.fileName} className="h-full w-full object-contain" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Segmentation Overlay</p>
              <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[1.2rem] bg-slate-900">
                <img src={record.previewImage} alt={record.fileName} className="h-full w-full object-contain" />
                {analysis.segmentationMask && (
                  <img
                    src={analysis.segmentationMask}
                    alt="Segmentation overlay"
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                    style={{ mixBlendMode: 'screen' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {keyFindings.length > 0 && (
          <div className="rounded-[1.2rem] border border-gray-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">Key Findings</p>
            <div className="mt-3 space-y-2">
              {keyFindings.map((item, index) => (
                <p key={`${record.clientRecordId}-finding-${index}`} className="text-sm leading-7 text-slate-700">
                  <span className="mr-2 font-black text-slate-500">{index + 1}.</span>
                  {item}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[1.2rem] border border-gray-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">Radiologist Impression</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">{impression}</p>
        </div>

        <div className="rounded-[1.2rem] border border-blue-100 bg-blue-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">Recommended Clinical Actions</p>
          <div className="mt-3 space-y-2">
            {recommendations.map(item => (
              <p key={item} className="text-sm leading-7 text-slate-700">{item}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SingleClassHistologyReport: React.FC<{ record: PatientRecord }> = ({ record }) => {
  const analysis = record.analysis;
  if (!analysis) return null;

  const reportId = record.clientRecordId.toUpperCase();
  const reportDate = formatReportDate(record.updatedAt || record.createdAt);
  const reportTime = formatReportTime(record.updatedAt || record.createdAt);
  const pathology = analysis.pathology.toLowerCase();
  const isMalignant = pathology === 'malignant';
  const isBenign = pathology === 'benign';
  const isNormal = pathology === 'normal';
  const borderColor = isMalignant ? '#dc2626' : isBenign ? '#059669' : '#2563eb';
  const headerClass = isMalignant ? 'bg-red-600' : isBenign ? 'bg-emerald-600' : 'bg-blue-600';
  const confidencePercent = analysis.confidence * 100;
  const confidenceColor = confidencePercent < 40 ? '#dc2626' : confidencePercent <= 80 ? '#f59e0b' : '#16a34a';
  const confidenceLabel = confidencePercent < 40 ? 'Low Confidence' : confidencePercent <= 80 ? 'Moderate Confidence' : 'High Confidence';
  const structuredReport = record.structuredReport;
  const clinicalHistory = getSectionText(structuredReport, 'Summary')
    || `Histopathology image submitted for AI-assisted single-class classification. ${analysis.insight}`;
  const microscopic = getSectionText(structuredReport, 'Histopathological Features')
    || `Sections demonstrate tissue architecture and cellular morphology consistent with ${analysis.pathology} classification. ${analysis.insight}`;
  const nextStepsRaw = getSectionText(structuredReport, 'Recommended Clinical Next Steps')
    || '1. Arrange specialist oncology consultation. 2. Confirm findings with biopsy or formal histopathological review. 3. Correlate with mammography, MRI, or ultrasound as clinically appropriate.';
  const steps = splitSteps(nextStepsRaw);
  const diagnosisLine = isMalignant
    ? 'Malignant tissue pattern identified by AI-assisted histopathological classification.'
    : isBenign
    ? 'Benign tissue pattern identified without malignant features on AI review.'
    : isNormal
    ? 'No pathological tissue pattern identified on AI review.'
    : 'Tissue pattern remains indeterminate on AI review.';

  return (
    <div className="overflow-hidden rounded-[1.75rem] border-2 border-gray-300 bg-white shadow-subtle">
      <div className="grid gap-4 border-b-2 border-gray-700 px-5 py-4 md:grid-cols-[84px_minmax(0,1fr)_220px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100">
          {record.previewImage ? (
            <img src={record.previewImage} alt={record.fileName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[84px] items-center justify-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Scan
            </div>
          )}
        </div>
        <div className="grid gap-x-8 gap-y-1 text-[11px] text-slate-700 sm:grid-cols-2">
          <p><span className="font-bold">Case#:</span> {reportId}</p>
          <p><span className="font-bold">Facility:</span> OncoScanAI AI Pathology Lab</p>
          <p><span className="font-bold">Patient File:</span> {record.fileName}</p>
          <p><span className="font-bold">MR#:</span> {reportId.replace(/^VH-/, '')}</p>
          <p><span className="font-bold">Engine:</span> {analysis.modelUsed}</p>
          <p><span className="font-bold">AI Confidence:</span> {confidencePercent.toFixed(1)}%</p>
        </div>
        <div className="space-y-1 text-right text-[11px] text-slate-700">
          <p><span className="font-bold">Collected:</span> {reportDate}</p>
          <p><span className="font-bold">Received:</span> {reportDate}</p>
          <p><span className="font-bold">Reported:</span> {reportDate} {reportTime}</p>
        </div>
      </div>

      <div className="border-b border-gray-300 bg-slate-50 px-5 py-4 text-center">
        <h2 className="font-serif text-[1.5rem] font-bold tracking-wide text-slate-800">Surgical Pathology Report</h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">AI-Assisted Histopathology Analysis</p>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className={headerClass}>
          <div className="px-3 py-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Diagnosis</p>
          </div>
          <div className="bg-white px-4 py-4" style={{ borderLeft: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderBottom: `4px solid ${borderColor}` }}>
            <p className="text-sm font-bold leading-7 text-slate-800">{diagnosisLine}</p>
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
                <span>AI Confidence</span>
                <span style={{ color: confidenceColor }}>{confidencePercent.toFixed(1)}% {confidenceLabel}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div className="h-full rounded-full" style={{ width: `${confidencePercent}%`, backgroundColor: confidenceColor }} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm leading-7 text-slate-700">
          <span className="font-bold">Note:</span> This report is AI-generated for preliminary clinical reference and requires pathologist validation before clinical use.
        </p>

        {record.previewImage && (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: 'Core Biopsies, Low Power', filter: 'none' },
              { label: 'Infiltrating Tissue Pattern', filter: 'contrast(1.2) saturate(1.25)' },
              { label: 'Focal Gland Formation', filter: 'contrast(1.35) brightness(0.88) saturate(0.75)' },
            ].map(image => (
              <div key={image.label}>
                <div className="h-40 overflow-hidden border border-gray-300 bg-slate-900">
                  <img src={record.previewImage} alt={image.label} className="h-full w-full object-cover" style={{ filter: image.filter }} />
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-500">{image.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Clinical History</p>
            <p className="mt-2 leading-7">{clinicalHistory}</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Sites</p>
            <p className="mt-2 leading-7">Histology image submitted for AI single-class classification.</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Microscopic</p>
            <p className="mt-2 leading-7">{microscopic}</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Recommended Clinical Next Steps</p>
            <div className="mt-2 space-y-2">
              {(steps.length ? steps : [nextStepsRaw]).map((step, index) => (
                <p key={`${record.clientRecordId}-step-${index}`} className="leading-7">
                  <span className="mr-2 font-semibold text-slate-500">{index + 1}.</span>
                  {step.replace(/^\d+\.\s*/, '')}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MultiClassHistologyReport: React.FC<{ record: PatientRecord }> = ({ record }) => {
  const prediction = record.prediction;
  if (!prediction) return null;

  const reportId = record.clientRecordId.toUpperCase();
  const reportDate = formatReportDate(record.updatedAt || record.createdAt);
  const reportTime = formatReportTime(record.updatedAt || record.createdAt);
  const fields = getPredictionFields(prediction);
  const isMalignant = fields.diagnosis === 'malignant';
  const isBenign = fields.diagnosis === 'benign';
  const borderColor = isMalignant ? '#dc2626' : isBenign ? '#059669' : '#2563eb';
  const headerClass = isMalignant ? 'bg-red-600' : isBenign ? 'bg-emerald-600' : 'bg-blue-600';
  const subclassPercent = (prediction.confidence ?? 0) * 100;
  const confidenceColor = subclassPercent < 40 ? '#dc2626' : subclassPercent <= 80 ? '#f59e0b' : '#16a34a';
  const confidenceLabel = subclassPercent < 40 ? 'Low Confidence' : subclassPercent <= 80 ? 'Moderate Confidence' : 'High Confidence';
  const structuredReport = record.structuredReport;
  const clinicalHistory = getSectionText(structuredReport, 'Summary')
    || `Breast histopathology image submitted for AI-assisted multi-class classification. Predicted subclass: ${fields.subclassLabel}. ${prediction.insight || ''}`;
  const microscopic = getSectionText(structuredReport, 'Histopathological Features')
    || `Atypical cellular morphology with disturbed tissue architecture in keeping with ${fields.subclassLabel}.`;
  const nextStepsRaw = getSectionText(structuredReport, 'Recommended Clinical Next Steps')
    || '1. Arrange specialist consultation with breast oncology or surgical oncology. 2. Recommend confirmatory pathological review to validate AI-based histological findings. 3. Correlate with mammography, MRI, or ultrasound as clinically appropriate.';
  const steps = splitSteps(nextStepsRaw);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border-2 border-gray-300 bg-white shadow-subtle">
      <div className="grid gap-4 border-b-2 border-gray-700 px-5 py-4 md:grid-cols-[84px_minmax(0,1fr)_220px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100">
          {record.previewImage ? (
            <img src={record.previewImage} alt={record.fileName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[84px] items-center justify-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Scan
            </div>
          )}
        </div>
        <div className="grid gap-x-8 gap-y-1 text-[11px] text-slate-700 sm:grid-cols-2">
          <p><span className="font-bold">Case#:</span> {reportId}</p>
          <p><span className="font-bold">Facility:</span> OncoScanAI AI Pathology Lab</p>
          <p><span className="font-bold">Patient File:</span> {record.fileName}</p>
          <p><span className="font-bold">MR#:</span> {reportId.replace(/^MH-/, '')}</p>
          <p><span className="font-bold">Engine:</span> OncoScanAI Master Model</p>
          <p><span className="font-bold">Subclass Confidence:</span> {subclassPercent.toFixed(1)}%</p>
          <p><span className="font-bold">Diagnosis Confidence:</span> {prediction.pathology_confidence != null ? `${(prediction.pathology_confidence * 100).toFixed(1)}%` : `${subclassPercent.toFixed(1)}%`}</p>
        </div>
        <div className="space-y-1 text-right text-[11px] text-slate-700">
          <p><span className="font-bold">Collected:</span> {reportDate}</p>
          <p><span className="font-bold">Received:</span> {reportDate}</p>
          <p><span className="font-bold">Reported:</span> {reportDate} {reportTime}</p>
        </div>
      </div>

      <div className="border-b border-gray-300 bg-slate-50 px-5 py-4 text-center">
        <h2 className="font-serif text-[1.5rem] font-bold tracking-wide text-slate-800">Surgical Pathology Report</h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">AI-Assisted Multi-Class Histopathology Analysis</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className={headerClass}>
          <div className="px-3 py-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Diagnosis</p>
          </div>
          <div className="bg-white px-4 py-4" style={{ borderLeft: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderBottom: `4px solid ${borderColor}` }}>
            <p className="text-sm font-bold leading-7 text-slate-800">
              {fields.subclassLabel}, {titleCase(fields.diagnosis)} tissue pattern identified by AI-assisted multi-class histopathology analysis.
            </p>
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
                <span>Subclass Confidence</span>
                <span style={{ color: confidenceColor }}>{subclassPercent.toFixed(1)}% {confidenceLabel}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div className="h-full rounded-full" style={{ width: `${subclassPercent}%`, backgroundColor: confidenceColor }} />
              </div>
            </div>
          </div>
        </div>

        {record.previewImage && (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: 'Core Biopsies, Low Power', filter: 'none' },
              { label: `${fields.subclassLabel} Pattern`, filter: 'contrast(1.2) saturate(1.25)' },
              { label: 'Focal Gland / Tissue Formation', filter: 'contrast(1.35) brightness(0.88) saturate(0.75)' },
            ].map(image => (
              <div key={image.label}>
                <div className="h-40 overflow-hidden border border-gray-300 bg-slate-900">
                  <img src={record.previewImage} alt={image.label} className="h-full w-full object-cover" style={{ filter: image.filter }} />
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-500">{image.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-[1.2rem] border border-rose-100 bg-rose-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Histological Subtype</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-rose-100 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-rose-500">Predicted Subclass</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{fields.subclassLabel}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-rose-500">Class ID</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{prediction.class_id != null ? String(prediction.class_id) : 'N/A'}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-rose-500">Subclass Confidence</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{subclassPercent.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-rose-500">Diagnosis Confidence</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {prediction.pathology_confidence != null ? `${(prediction.pathology_confidence * 100).toFixed(1)}%` : `${subclassPercent.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Clinical History</p>
            <p className="mt-2 leading-7">{clinicalHistory}</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Sites</p>
            <p className="mt-2 leading-7">Breast histopathology image submitted for AI multi-class subtype classification.</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Microscopic</p>
            <p className="mt-2 leading-7">{microscopic}</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">Recommended Clinical Next Steps</p>
            <div className="mt-2 space-y-2">
              {(steps.length ? steps : [nextStepsRaw]).map((step, index) => (
                <p key={`${record.clientRecordId}-step-${index}`} className="leading-7">
                  <span className="mr-2 font-semibold text-slate-500">{index + 1}.</span>
                  {step.replace(/^\d+\.\s*/, '')}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className="border-t border-gray-100 pt-4 text-sm leading-7 text-slate-700">
          <span className="font-bold">Note:</span> This report is AI-generated for preliminary clinical reference and requires qualified pathologist review before clinical use.
        </p>
      </div>
    </div>
  );
};

const GenericRecordReport: React.FC<{ record: PatientRecord }> = ({ record }) => {
  const reportDate = formatReportDate(record.updatedAt || record.createdAt);
  const reportTime = formatReportTime(record.updatedAt || record.createdAt);

  return (
    <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-subtle">
      <div className="border-b border-gray-100 pb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Saved Report</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">{record.studyTitle}</h2>
        <p className="mt-2 text-sm text-slate-500">{record.fileName}</p>
        <p className="mt-1 text-xs text-slate-400">{reportDate} {reportTime}</p>
      </div>

      <div className="mt-5">
        {record.suggestiveReport ? (
          <div className="rounded-[1.2rem] border border-gray-100 bg-slate-50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{record.suggestiveReport}</p>
          </div>
        ) : structuredSections(record.structuredReport)}
      </div>
    </div>
  );
};

const structuredSections = (report?: StructuredReport) => {
  if (!report?.sections?.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-gray-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
        This saved record contains the scan activity, but no generated narrative report text was returned for it.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {report.sections.map(section => (
        <div key={section.title} className="rounded-[1.2rem] border border-gray-100 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{section.title}</p>
          {section.description && (
            <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
          )}
          {section.subsections?.length ? (
            <div className="mt-3 space-y-2">
              {section.subsections.map(subsection => (
                <div key={`${section.title}-${subsection.label}`} className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{subsection.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{subsection.content}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const PatientRecordReport: React.FC<{ record: PatientRecord }> = ({ record }) => {
  if (record.sourcePage === 'ultrasound-analysis' && record.analysis) {
    return <UltrasoundReport record={record} />;
  }

  if (record.sourcePage === 'vision-workbench' && record.analysis) {
    return <SingleClassHistologyReport record={record} />;
  }

  if (record.sourcePage === 'multi-class-histo' && record.prediction) {
    return <MultiClassHistologyReport record={record} />;
  }

  return <GenericRecordReport record={record} />;
};

export default PatientRecordReport;
