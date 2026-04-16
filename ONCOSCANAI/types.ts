
export interface AnalysisResult {
  pathology: 'Benign' | 'Malignant' | 'Normal' | 'Inconclusive';
  confidence: number;
  heatmapUrl?: string;
  insight: string;
  modelUsed: string;
  segmentationMask?: string;
  maskType?: string;
  // Optional fields added for frontend visualisations and simulations
  maskPath?: string;
  pixels?: number;
  area?: number;
  lesionLocation?: any;
}

export interface SuggestiveReportData {
  summary: string;
  impression: string;
  recommendedClinicalNextSteps: string[];
  disclaimer: string;
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
  prediction?: {
    result: 'Benign' | 'Malignant' | 'Normal' | 'Inconclusive';
    confidence: number;
    insight?: string;
  };
  suggestiveReport?: string;
  suggestiveReportData?: SuggestiveReportData;
  reportStatus?: 'Idle' | 'Generating' | 'Complete' | 'Failed';
  reportError?: string;
}
