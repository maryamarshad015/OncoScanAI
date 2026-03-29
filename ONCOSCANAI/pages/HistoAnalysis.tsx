import React, { useMemo, useRef, useState } from 'react';
import type { AnalysisResult, UploadedFile } from '../types';
import {
  CheckCircleIcon,
  InfoIcon,
  ModelIcon,
  UploadIcon,
  VisionIcon,
} from '../components/icons';

type ModelType = 'alexnet' | 'yolov11' | 'efficient_net';
type HistoPrediction = NonNullable<UploadedFile['prediction']>;
type HistoErrorResponse = { detail?: string };
type HistoInferenceResponse = {
  result?: string;
  confidence?: number | string;
  insight?: string;
  engine?: string;
};

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

const getModelDisplayName = (modelKey: ModelType | string) => {
  const labels: Record<string, string> = {
    alexnet: 'AlexNet',
    yolov11: 'YOLO V11',
    efficient_net: 'EfficientNet',
  };
  return labels[modelKey] || modelKey.toUpperCase();
};

const normalizePathology = (value?: string): AnalysisResult['pathology'] => {
  const normalized = (value || 'Inconclusive').trim().toLowerCase();
  if (normalized === 'malignant') return 'Malignant';
  if (normalized === 'benign') return 'Benign';
  if (normalized === 'normal') return 'Normal';
  return 'Inconclusive';
};

const getPathologyAccent = (pathology: AnalysisResult['pathology']) => {
  if (pathology === 'Malignant') {
    return {
      badge: 'bg-red-500 text-white',
      panel: 'bg-red-50/70 border-red-100 shadow-red-50',
      bar: 'bg-red-500',
      text: 'text-red-700',
    };
  }
  if (pathology === 'Benign') {
    return {
      badge: 'bg-green-500 text-white',
      panel: 'bg-green-50/70 border-green-100 shadow-green-50',
      bar: 'bg-green-500',
      text: 'text-green-700',
    };
  }
  if (pathology === 'Normal') {
    return {
      badge: 'bg-blue-500 text-white',
      panel: 'bg-blue-50/70 border-blue-100 shadow-blue-50',
      bar: 'bg-blue-500',
      text: 'text-blue-700',
    };
  }
  return {
    badge: 'bg-slate-500 text-white',
    panel: 'bg-slate-50/70 border-slate-200 shadow-slate-50',
    bar: 'bg-slate-500',
    text: 'text-slate-700',
  };
};

const ModelSelector: React.FC<{
  selectedModel: ModelType;
  onSelect: (model: ModelType) => void;
}> = ({ selectedModel, onSelect }) => {
  const baseClasses =
    'px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 focus:outline-none';
  const activeClasses =
    'bg-brand-pink text-white shadow-lg shadow-pink-100 ring-2 ring-white ring-offset-2 ring-offset-brand-pink';
  const inactiveClasses = 'bg-white text-gray-400 hover:text-gray-600 border border-gray-200';

  return (
    <div className="flex items-center gap-6">
      <div className="flex p-1 bg-gray-100 rounded-xl space-x-1 border border-gray-200">
        <button
          onClick={() => onSelect('alexnet')}
          className={`${baseClasses} ${selectedModel === 'alexnet' ? activeClasses : inactiveClasses}`}
        >
          AlexNet
        </button>
        <button
          onClick={() => onSelect('yolov11')}
          className={`${baseClasses} ${selectedModel === 'yolov11' ? activeClasses : inactiveClasses}`}
        >
          YOLO V11
        </button>
        <button
          onClick={() => onSelect('efficient_net')}
          className={`${baseClasses} ${selectedModel === 'efficient_net' ? activeClasses : inactiveClasses}`}
        >
          EfficientNet
        </button>
      </div>
    </div>
  );
};

const AnalysisStatCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
    <p className="text-lg font-black text-slate-800 mt-2 tracking-tight">{value}</p>
  </div>
);

const ThumbnailFallback: React.FC<{ type: string }> = ({ type }) => (
  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] font-black text-slate-500 uppercase">
    {type}
  </div>
);

const HistoAnalysis: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('alexnet');
  const sourceFilesRef = useRef<Record<string, File>>({});

  const selectedFile = useMemo(
    () => files.find(file => file.id === selectedFileId) ?? null,
    [files, selectedFileId]
  );

  const updateFile = (fileId: string, updater: (file: UploadedFile) => UploadedFile) => {
    setFiles(currentFiles => currentFiles.map(file => (file.id === fileId ? updater(file) : file)));
  };

  const runAnalysis = async (upload: UploadedFile, fileToUpload: File, modelName: ModelType) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);

    const progressInterval = setInterval(() => {
      updateFile(upload.id, file => {
        if ((file.progress || 0) >= 90 || file.status === 'Complete' || file.status === 'Failed') {
          return file;
        }
        return {
          ...file,
          status: 'Analyzing',
          progress: Math.min((file.progress || 0) + 10, 90),
        };
      });
    }, 120);

    try {
      const response = await fetch(`/predict/histo/${modelName}`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch((): HistoErrorResponse => ({ detail: `Inference failed: ${response.statusText}` })) as HistoErrorResponse;
        throw new Error(errorData.detail || 'Analysis failed');
      }

      const json = (await response.json()) as HistoInferenceResponse;
      const confidence =
        typeof json.confidence === 'number' ? json.confidence : Number(json.confidence) || 0;

      const analysis: AnalysisResult = {
        pathology: normalizePathology(json.result),
        confidence,
        insight: json.insight || '',
        modelUsed: getModelDisplayName(modelName),
      };

      const prediction: HistoPrediction = {
        result: analysis.pathology,
        confidence: analysis.confidence,
        insight: analysis.insight,
      };

      updateFile(upload.id, file => ({
        ...file,
        status: 'Complete',
        progress: 100,
        analysis,
        prediction,
        errorMessage: undefined,
      }));
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : 'Neural link failure.';
      updateFile(upload.id, file => ({
        ...file,
        status: 'Failed',
        progress: 100,
        errorMessage,
      }));
    }
  };

  const handleFiles = async (newFiles: File[]) => {
    const activeModel = selectedModel;
    const newUploads: UploadedFile[] = newFiles.map((file, index) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const type =
        extension === 'svs' || extension === 'tiff' || extension === 'png' || extension === 'jpg' || extension === 'jpeg'
          ? extension
          : 'scan';

      return {
        id: String(Date.now() + index),
        name: file.name,
        size: formatBytes(file.size),
        status: 'Uploading',
        type,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
      };
    });

    newUploads.forEach((upload, index) => {
      sourceFilesRef.current[upload.id] = newFiles[index];
    });

    setFiles(prev => [...newUploads, ...prev]);
    if (newUploads.length > 0) {
      setSelectedFileId(newUploads[0].id);
    }

    for (const [index, upload] of newUploads.entries()) {
      const fileToUpload = newFiles[index];
      if (!fileToUpload) continue;
      await runAnalysis(upload, fileToUpload, activeModel);
    }
  };

  const retrySelectedFile = async () => {
    if (!selectedFile) return;
    const rawFile = sourceFilesRef.current[selectedFile.id];
    if (!rawFile) {
      updateFile(selectedFile.id, file => ({
        ...file,
        status: 'Failed',
        errorMessage: 'Original file is no longer available for retry.',
      }));
      return;
    }
    await runAnalysis(selectedFile, rawFile, selectedModel);
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, entering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(entering);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void handleFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2rem] shadow-subtle border border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-slate-50">
        <div>
          <h2 className="text-3xl font-black text-brand-text-primary tracking-tighter mb-2">Histo Analysis</h2>
          <p className="text-brand-text-secondary text-sm font-medium">
            Review uploaded histology scans with AlexNet, YOLO V11, or EfficientNet.
          </p>
        </div>
        <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
      </div>

      <div className="grid lg:grid-cols-4 gap-6 min-h-[720px]">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-subtle border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Selected Engine</p>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Histology Model</p>
                <p className="text-xl font-black text-slate-900 tracking-tight mt-2">
                  {getModelDisplayName(selectedModel)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-pink/10 flex items-center justify-center">
                <ModelIcon className="w-6 h-6 text-brand-pink" />
              </div>
            </div>
          </div>

          <div
            className={`flex-grow bg-white rounded-2xl border-2 border-dashed flex flex-col overflow-hidden transition-all ${
              isDragging ? 'border-brand-pink bg-pink-50' : 'border-slate-200'
            }`}
            onDragEnter={e => handleDragEvents(e, true)}
            onDragLeave={e => handleDragEvents(e, false)}
            onDragOver={e => handleDragEvents(e, true)}
            onDrop={handleDrop}
          >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Clinical Queue</h3>
              <span className="text-[10px] font-black bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                {files.length}
              </span>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-2">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <UploadIcon className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-black text-slate-700 tracking-tight">Drop histology scans here</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed mt-3">
                    PNG, JPG, TIFF or SVS
                  </p>
                </div>
              ) : (
                files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`w-full flex items-center p-2 rounded-xl transition-all group ${
                      selectedFileId === file.id ? 'bg-pink-50 ring-1 ring-brand-pink' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-200 mr-3 flex-shrink-0 overflow-hidden border border-slate-100">
                      {file.previewUrl ? (
                        <img src={file.previewUrl} className="w-full h-full object-cover" alt={file.name} />
                      ) : (
                        <ThumbnailFallback type={file.type} />
                      )}
                    </div>
                    <div className="text-left overflow-hidden flex-grow">
                      <p className="text-xs font-bold truncate text-slate-700">{file.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest ${
                            file.status === 'Complete'
                              ? 'text-green-600'
                              : file.status === 'Failed'
                                ? 'text-red-500'
                                : 'text-slate-400'
                          }`}
                        >
                          {file.status}
                        </span>
                        {file.status === 'Complete' && <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />}
                        {(file.status === 'Uploading' || file.status === 'Analyzing') && (
                          <div className="w-3 h-3 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                        )}
                        {file.status === 'Failed' && <InfoIcon className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <input
                type="file"
                id="histo-file-upload"
                className="hidden"
                multiple
                accept=".png,.jpg,.jpeg,.svs,.tiff"
                onChange={e => e.target.files && void handleFiles(Array.from(e.target.files))}
              />
              <label
                htmlFor="histo-file-upload"
                className="flex items-center justify-center w-full py-3 bg-brand-pink text-white text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer hover:bg-brand-pink-dark transition-all shadow-lg shadow-pink-100"
              >
                Import Scan
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-6">
          {selectedFile ? (
            <div className="flex-grow bg-white rounded-3xl shadow-subtle border border-slate-200 flex flex-col overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white text-brand-pink rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                    <VisionIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">{selectedFile.name}</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      Engine:{' '}
                      {selectedFile.analysis?.modelUsed || getModelDisplayName(selectedModel)} |{' '}
                      {selectedFile.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">File Size</p>
                  <p className="text-sm font-black text-slate-700 mt-1">{selectedFile.size}</p>
                </div>
              </div>

              <div className="flex-grow p-8 overflow-y-auto grid md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="relative group">
                    <div className="aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center border-8 border-slate-50">
                      {selectedFile.previewUrl ? (
                        <img
                          src={selectedFile.previewUrl}
                          className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                          alt={selectedFile.name}
                        />
                      ) : (
                        <div className="text-center text-white/80 px-8">
                          <p className="text-lg font-black">Preview unavailable</p>
                          <p className="text-xs uppercase tracking-[0.2em] mt-2">{selectedFile.type.toUpperCase()}</p>
                        </div>
                      )}
                      {(selectedFile.status === 'Uploading' || selectedFile.status === 'Analyzing') && (
                        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center">
                          <div className="w-16 h-16 border-4 border-brand-pink border-t-transparent rounded-full animate-spin mb-6" />
                          <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                            Running Neural Pass...
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-6 left-6 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                      Uploaded Scan
                    </div>
                  </div>

                </div>

                <div className="flex flex-col">
                  {selectedFile.status === 'Complete' && selectedFile.analysis ? (
                    <div className="space-y-8 h-full flex flex-col">
                      {(() => {
                        const accent = getPathologyAccent(selectedFile.analysis.pathology);
                        return (
                          <div className={`p-8 rounded-[2rem] border-2 shadow-lg transition-all ${accent.panel}`}>
                            <div className="flex items-center justify-between mb-6">
                              <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${accent.badge}`}>
                                {selectedFile.analysis.pathology}
                              </span>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inference Confidence</p>
                                <p className="text-3xl font-black text-slate-800 tracking-tighter">
                                  {(selectedFile.analysis.confidence * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="h-2.5 w-full bg-white rounded-full overflow-hidden shadow-inner">
                              <div
                                className={`h-full transition-all duration-[1500ms] ease-out ${accent.bar}`}
                                style={{ width: `${selectedFile.analysis.confidence * 100}%` }}
                              />
                            </div>
                            <p className={`mt-5 text-sm font-bold ${accent.text}`}>
                              Local inference completed with {selectedFile.analysis.modelUsed}.
                            </p>
                          </div>
                        );
                      })()}

                      <div className="grid sm:grid-cols-2 gap-4">
                        <AnalysisStatCard title="Model" value={selectedFile.analysis.modelUsed} />
                        <AnalysisStatCard title="Scan Type" value={selectedFile.type.toUpperCase()} />
                      </div>

                      <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 relative overflow-hidden">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-brand-pink/10 flex items-center justify-center">
                            <InfoIcon className="w-4 h-4 text-brand-pink" />
                          </div>
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Neural Insight</h4>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                          "{selectedFile.analysis.insight || 'No additional insight returned by the backend.'}"
                        </p>
                      </div>

                      <div className="mt-auto pt-8 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                            <ModelIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Histology Engine</p>
                            <p className="text-xs font-bold text-slate-700">{selectedFile.analysis.modelUsed}</p>
                          </div>
                        </div>
                        <span className="px-5 py-3 bg-green-50 text-green-700 text-xs font-black uppercase tracking-widest rounded-2xl border border-green-100">
                          Result Ready
                        </span>
                      </div>
                    </div>
                  ) : selectedFile.status === 'Failed' ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-12">
                      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <InfoIcon className="w-10 h-10" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Neural Link Severed</h3>
                      <p className="text-slate-500 text-sm max-w-xs mb-8">{selectedFile.errorMessage}</p>
                      <button
                        onClick={() => void retrySelectedFile()}
                        className="px-8 py-3 border-2 border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-brand-pink hover:text-brand-pink transition-all"
                      >
                        Retry Inference
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                      <div className="relative">
                        <div className="w-32 h-32 border-2 border-brand-pink/20 rounded-full animate-[spin_3s_linear_infinite]" />
                        <div className="w-32 h-32 border-t-2 border-brand-pink rounded-full animate-spin absolute inset-0" />
                        <VisionIcon className="w-10 h-10 text-brand-pink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Processing Tensor</h3>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                          Optimizing local inference...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 flex-grow flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 text-center p-20">
              <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center mb-10 border border-slate-100 rotate-3 transform transition-transform hover:rotate-0">
                <VisionIcon className="w-14 h-14 text-slate-200" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-4">Histology Workbench Ready</h2>
              <p className="text-slate-400 max-w-md text-sm leading-relaxed">
                Import a histology scan to inspect the uploaded image, watch the live inference state, and review the diagnostic summary in one place.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoAnalysis;
