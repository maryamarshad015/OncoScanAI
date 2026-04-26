import type { User } from 'firebase/auth';
import type { AnalysisResult, HistoPrediction, PatientRecord, StructuredReport, UploadedFile } from '../types';

export interface PatientRecordUpsertPayload {
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  clientRecordId: string;
  fileName: string;
  sourcePage: string;
  modality: string;
  studyTitle: string;
  studyType: string;
  status: UploadedFile['status'];
  reportStatus?: UploadedFile['reportStatus'];
  previewImage?: string;
  analysis?: AnalysisResult;
  prediction?: HistoPrediction;
  suggestiveReport?: string;
  structuredReport?: StructuredReport;
}

const RECORDS_API_BASE = '/records';
const LOCAL_RECORDS_KEY = 'oncoscan_patient_records_v1';
const buildIdentityKeys = (userId: string, userEmail?: string) =>
  [`uid:${userId}`, userEmail ? `email:${userEmail.trim().toLowerCase()}` : null].filter(Boolean) as string[];

export const createRecordId = (prefix = 'record') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getPatientIdentity = (user: User | null) => {
  if (!user?.uid) return null;
  return {
    userId: user.uid,
    userEmail: user.email || undefined,
    userDisplayName: user.displayName || undefined,
  };
};

const canGenerateBrowserPreview = (file: File) => {
  if (file.type.startsWith('image/')) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp';
};

export const fileToDataUrl = (file: File, maxDimension = 640, quality = 0.82) =>
  new Promise<string | undefined>((resolve) => {
    if (!canGenerateBrowserPreview(file)) {
      resolve(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(undefined);
    };

    image.src = objectUrl;
  });

const hasWindow = () => typeof window !== 'undefined';

const readLocalRecordsMap = (): Record<string, PatientRecord[]> => {
  if (!hasWindow()) return {};

  try {
    const raw = window.localStorage.getItem(LOCAL_RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PatientRecord[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getAllLocalRecords = () => {
  const map = readLocalRecordsMap();
  const everyList = Object.values(map).flatMap(records => Array.isArray(records) ? records : []);
  return mergeRecordLists(everyList, []);
};

const writeLocalRecordsMap = (map: Record<string, PatientRecord[]>) => {
  if (!hasWindow()) return;

  try {
    window.localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota/cache write failures and still allow backend persistence.
  }
};

const mergeRecordLists = (primary: PatientRecord[], secondary: PatientRecord[]) => {
  const byId = new Map<string, PatientRecord>();

  [...secondary, ...primary].forEach(record => {
    const existing = byId.get(record.clientRecordId);
    if (!existing) {
      byId.set(record.clientRecordId, record);
      return;
    }

    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const currentTime = new Date(record.updatedAt || record.createdAt || 0).getTime();
    if (currentTime >= existingTime) {
      byId.set(record.clientRecordId, record);
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
};

const getLocalRecords = (userId: string, userEmail?: string) => {
  const map = readLocalRecordsMap();
  const keys = buildIdentityKeys(userId, userEmail);
  const collected = keys.flatMap(key => Array.isArray(map[key]) ? map[key] : []);
  if (collected.length > 0) {
    return mergeRecordLists(collected, []);
  }
  return getAllLocalRecords();
};

const setLocalRecords = (userId: string, userEmail: string | undefined, records: PatientRecord[]) => {
  const map = readLocalRecordsMap();
  buildIdentityKeys(userId, userEmail).forEach(key => {
    map[key] = records;
  });
  writeLocalRecordsMap(map);
};

const buildLocalRecord = (payload: PatientRecordUpsertPayload, previous?: PatientRecord): PatientRecord => {
  const now = new Date().toISOString();

  return {
    id: previous?.id || Date.now(),
    clientRecordId: payload.clientRecordId,
    userId: payload.userId,
    userEmail: payload.userEmail,
    userDisplayName: payload.userDisplayName,
    fileName: payload.fileName,
    sourcePage: payload.sourcePage,
    modality: payload.modality,
    studyTitle: payload.studyTitle,
    studyType: payload.studyType,
    status: payload.status,
    reportStatus: payload.reportStatus,
    previewImage: payload.previewImage,
    analysis: payload.analysis,
    prediction: payload.prediction,
    suggestiveReport: payload.suggestiveReport,
    structuredReport: payload.structuredReport,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
};

const cachePatientRecord = (record: PatientRecord) => {
  const current = getLocalRecords(record.userId, record.userEmail);
  setLocalRecords(record.userId, record.userEmail, mergeRecordLists([record], current));
  return record;
};

export async function upsertPatientRecord(payload: PatientRecordUpsertPayload): Promise<PatientRecord> {
  const previous = getLocalRecords(payload.userId, payload.userEmail).find(record => record.clientRecordId === payload.clientRecordId);
  const optimisticRecord = cachePatientRecord(buildLocalRecord(payload, previous));

  try {
    const response = await fetch(`${RECORDS_API_BASE}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payload.userId,
        user_email: payload.userEmail,
        user_display_name: payload.userDisplayName,
        client_record_id: payload.clientRecordId,
        file_name: payload.fileName,
        source_page: payload.sourcePage,
        modality: payload.modality,
        study_title: payload.studyTitle,
        study_type: payload.studyType,
        status: payload.status,
        report_status: payload.reportStatus,
        preview_image: payload.previewImage,
        analysis: payload.analysis,
        prediction: payload.prediction,
        suggestive_report: payload.suggestiveReport,
        structured_report: payload.structuredReport,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => `Status ${response.status}`);
      throw new Error(detail || `Unable to save record (${response.status})`);
    }

    const savedRecord = await response.json() as PatientRecord;
    return cachePatientRecord(savedRecord);
  } catch {
    return optimisticRecord;
  }
}

export async function fetchPatientRecords(userId: string, userEmail?: string): Promise<PatientRecord[]> {
  const localRecords = getLocalRecords(userId, userEmail);

  try {
    const params = new URLSearchParams();
    if (userEmail) params.set('user_email', userEmail);
    const query = params.toString();
    const response = await fetch(`${RECORDS_API_BASE}/${encodeURIComponent(userId)}${query ? `?${query}` : ''}`);
    if (!response.ok) {
      const detail = await response.text().catch(() => `Status ${response.status}`);
      throw new Error(detail || `Unable to load records (${response.status})`);
    }

    const remoteRecords = await response.json() as PatientRecord[];
    const merged = mergeRecordLists(remoteRecords, localRecords);
    setLocalRecords(userId, userEmail, merged);
    return merged;
  } catch {
    return localRecords;
  }
}
