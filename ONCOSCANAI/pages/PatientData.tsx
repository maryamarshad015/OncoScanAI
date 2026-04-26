import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { PatientRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import PatientRecordReport from '../components/PatientRecordReport';
import { PatientDataIcon, VisionIcon, ModelIcon, InfoIcon } from '../components/icons';
import { fetchPatientRecords } from '../utils/patientRecords';

type ModalityFilter = 'all' | 'ultrasound' | 'histopathology';

const titleCase = (value?: string) =>
  (value || '')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const getOutcome = (record: PatientRecord) => {
  const raw = record.analysis?.pathology
    || record.prediction?.diagnosis_prediction
    || record.prediction?.diagnosis
    || record.prediction?.pathology_group
    || record.prediction?.result;
  return titleCase(raw) || 'In Review';
};

const getHeadline = (record: PatientRecord) => {
  if (record.modality === 'ultrasound') return `${getOutcome(record)} Ultrasound Study`;
  const subclass = record.prediction?.subclass_prediction || record.prediction?.subclass;
  return subclass ? `${titleCase(subclass)} Histology Study` : record.studyTitle;
};

const getCategoryLabel = (record: PatientRecord) => {
  if (record.modality === 'ultrasound') return 'ULTRASOUND ANALYSIS';
  if (record.sourcePage === 'multi-class-histo') return 'MULTI-CLASS HISTOLOGY';
  return 'BIOPSY ANALYSIS';
};

const getBadgeClass = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('malignant')) return 'bg-red-50 text-red-700 border-red-100';
  if (normalized.includes('benign')) return 'bg-green-50 text-green-700 border-green-100';
  if (normalized.includes('normal')) return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const getStatusLabel = (record: PatientRecord) => {
  if (record.status === 'Failed') return 'Upload Failed';
  if (record.reportStatus === 'Complete') return getOutcome(record);
  if (record.status === 'Complete') return 'Analysis Complete';
  return 'Processing';
};

const getStatusTone = (record: PatientRecord) => {
  const label = getStatusLabel(record).toLowerCase();
  if (label.includes('malignant')) return 'bg-red-50 text-red-700';
  if (label.includes('benign')) return 'bg-green-50 text-green-700';
  if (label.includes('normal')) return 'bg-emerald-50 text-emerald-700';
  if (label.includes('failed')) return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
};

const PatientData: React.FC = () => {
  const { currentUser } = useAuth();
  const { recordId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      if (!currentUser?.uid) {
        if (active) {
          setRecords([]);
          setLoading(false);
        }
        return;
      }

      const data = await fetchPatientRecords(currentUser.uid, currentUser.email || undefined);
      if (!active) return;
      setRecords(data);
      setLoading(false);
    };

    void loadRecords();
    const intervalId = window.setInterval(() => {
      void loadRecords();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [currentUser?.email, currentUser?.uid]);

  const years = useMemo(
    () => Array.from(new Set(records.map(record => new Date(record.createdAt).getFullYear().toString()))).sort((a, b) => Number(b) - Number(a)),
    [records]
  );

  const filteredRecords = useMemo(() => (
    records.filter(record => {
      const matchesModality = modalityFilter === 'all' || record.modality === modalityFilter;
      const matchesYear = yearFilter === 'all' || new Date(record.createdAt).getFullYear().toString() === yearFilter;
      return matchesModality && matchesYear;
    })
  ), [modalityFilter, records, yearFilter]);

  const patientName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Patient';
  const basePath = location.pathname.startsWith('/dashboard/reports') ? '/dashboard/reports' : '/dashboard/patient-data';
  const selectedRecord = recordId ? records.find(record => record.clientRecordId === decodeURIComponent(recordId)) || null : null;

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-subtle">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-pink/20 border-t-brand-pink" />
        <h2 className="text-lg font-black text-brand-text-primary">Loading patient history</h2>
      </div>
    );
  }

  if (recordId && !selectedRecord) {
    return (
      <div className="space-y-6">
        <Link to={basePath} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:border-brand-pink hover:text-brand-pink">
          <span>&lt;</span>
          <span>Back to History</span>
        </Link>
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center shadow-subtle">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
            <InfoIcon className="h-8 w-8 text-brand-pink" />
          </div>
          <h2 className="text-xl font-black text-brand-text-primary">Record not found</h2>
          <p className="mt-2 max-w-md text-sm text-brand-text-secondary">This saved patient activity could not be found in the current history list.</p>
        </div>
      </div>
    );
  }

  if (selectedRecord) {
    return (
      <div className="space-y-6">
        <Link to={basePath} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:border-brand-pink hover:text-brand-pink">
          <span>&lt;</span>
          <span>Back to History</span>
        </Link>
        <PatientRecordReport record={selectedRecord} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-gray-100 bg-white px-6 py-7 shadow-subtle sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-pink">My Records</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-text-primary">{patientName}&apos;s Scan History</h1>
            <p className="mt-2 text-sm text-brand-text-secondary">All your previous scans and generated reports are stored here by your logged-in Firebase patient account.</p>
          </div>
          <div className="rounded-2xl bg-brand-pink px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-100">
            {records.length} Saved Record{records.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Scans' },
          { key: 'histopathology', label: 'Biopsy' },
          { key: 'ultrasound', label: 'Ultrasound' },
        ].map(filter => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setModalityFilter(filter.key as ModalityFilter)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
              modalityFilter === filter.key
                ? 'border-brand-pink bg-brand-pink text-white shadow-lg shadow-pink-100'
                : 'border-gray-200 bg-white text-slate-500 hover:border-brand-pink/30 hover:text-brand-pink'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {years.map(year => (
          <button
            key={year}
            type="button"
            onClick={() => setYearFilter(year)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
              yearFilter === year
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-gray-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {year}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setYearFilter('all')}
          className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
            yearFilter === 'all'
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-gray-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}
        >
          All Years
        </button>
      </section>

      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center shadow-subtle">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
            <PatientDataIcon className="h-8 w-8 text-brand-pink" />
          </div>
          <h2 className="text-xl font-black text-brand-text-primary">No patient activity found</h2>
          <p className="mt-2 max-w-md text-sm text-brand-text-secondary">Upload or analyze a scan from Histopathology, Multi-Class Histopathology, or Ultrasound and the card will appear here.</p>
        </div>
      ) : (
        <section className="space-y-4">
          {filteredRecords.map(record => (
            <button
              key={record.clientRecordId}
              type="button"
              onClick={() => navigate(`${basePath}/${encodeURIComponent(record.clientRecordId)}`)}
              className="flex w-full overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white text-left shadow-subtle transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`relative min-h-[178px] w-48 flex-shrink-0 overflow-hidden sm:w-56 ${record.modality === 'ultrasound' ? 'bg-gradient-to-br from-blue-100 via-sky-50 to-blue-200' : 'bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200'}`}>
                <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-600 shadow-sm">
                  {formatShortDate(record.createdAt)}
                </span>
                {record.previewImage ? (
                  <img src={record.previewImage} alt={record.fileName} className="h-full w-full object-cover opacity-90" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    {record.modality === 'ultrasound'
                      ? <ModelIcon className="h-14 w-14 text-sky-500/80" />
                      : <VisionIcon className="h-14 w-14 text-pink-500/80" />}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${record.modality === 'ultrasound' ? 'text-sky-600' : 'text-pink-600'}`}>
                        {getCategoryLabel(record)}
                      </p>
                      <h3 className="mt-2 text-xl font-black leading-tight text-slate-900">{getHeadline(record)}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">{record.fileName}</p>
                      <p className="mt-1 text-xs text-slate-400">{record.userDisplayName || patientName} · OncoScanAI</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${getStatusTone(record)}`}>
                      {getStatusLabel(record)}
                    </span>
                  </div>

                  {(record.suggestiveReport || record.analysis?.insight || record.prediction?.insight) && (
                    <p className="max-w-3xl text-sm leading-6 text-slate-500">
                      {(record.suggestiveReport || record.analysis?.insight || record.prediction?.insight || '').slice(0, 180)}
                      {(record.suggestiveReport || record.analysis?.insight || record.prediction?.insight || '').length > 180 ? '...' : ''}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${getBadgeClass(getOutcome(record))}`}>
                    {getOutcome(record)}
                  </span>
                  <span className="text-sm font-bold text-brand-pink">Open Record -&gt;</span>
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {records.length > 0 && filteredRecords.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <InfoIcon className="h-5 w-5" />
          <span>Your activity exists, but the current filters are hiding it.</span>
        </div>
      )}
    </div>
  );
};

export default PatientData;
