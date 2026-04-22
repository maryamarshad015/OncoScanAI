
export interface AnalysisResult {
  pathology: 'Benign' | 'Malignant' | 'Normal' | 'Inconclusive';
  confidence: number;
  heatmapUrl?: string;
  insight: string;
  modelUsed: string;
  classificationEngine?: string;
  segmentationEngine?: string;
  segmentationMask?: string;
  maskType?: string;
  // Optional fields added for frontend visualisations and simulations
  maskPath?: string;
  pixels?: number;
  area?: number;
  lesionLocation?: any;
}

export interface HistoPrediction {
  subclass?: string;
  subclass_prediction?: string;
  result: string;
  confidence: number;
  diagnosis?: 'benign' | 'malignant' | 'normal' | 'inconclusive' | 'unknown';
  diagnosis_prediction?: 'benign' | 'malignant' | 'normal' | 'inconclusive' | 'unknown';
  pathology_group?: 'benign' | 'malignant' | 'normal' | 'inconclusive' | 'unknown';
  pathology_confidence?: number;
  class_id?: number;
  insight?: string;
}

export interface ReportSection {
  title: string;
  description?: string;
  subsections?: Array<{
    label: string;
    content: string;
    isHighlighted?: boolean;
  }>;
}

export interface StructuredReport {
  patientInfo?: Record<string, string>;
  sections: ReportSection[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  status: 'Pending' | 'Uploading' | 'Analyzing' | 'Complete' | 'Failed';
  type: string;
  previewUrl?: string;
  analysis?: AnalysisResult;
  errorMessage?: string;
  // Progress tracker for async operations used in HistoAnalysis
  progress?: number;
  // Specific prediction format used in HistoAnalysis
  prediction?: HistoPrediction;
  suggestiveReport?: string;
  structuredReport?: StructuredReport;
  reportStatus?: 'Idle' | 'Generating' | 'Complete' | 'Failed';
  reportError?: string;
  magnificationLevel?: string;
}
