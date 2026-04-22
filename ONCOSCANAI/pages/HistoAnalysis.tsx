
import React, { useState } from 'react';
import type { HistoPrediction, UploadedFile } from '../types';
import { UploadIcon, CheckCircleIcon, InfoIcon } from '../components/icons';

const FileIcon: React.FC<{ type: UploadedFile['type'] }> = ({ type }) => (
    <div className="w-10 h-10 flex-shrink-0 mr-4 rounded-lg bg-gray-200 flex items-center justify-center border border-gray-300">
        <span className="text-[10px] font-black text-gray-500 uppercase">{type.toUpperCase()}</span>
    </div>
);

type ErrorResponse = {
    detail?: string;
};

const PredictionResult: React.FC<{ prediction: HistoPrediction }> = ({ prediction }) => {
    if (!prediction) return null;
    const confidenceColor = prediction.confidence > 0.8 ? 'bg-brand-pink' : prediction.confidence > 0.6 ? 'bg-yellow-500' : 'bg-green-500';
    const getResultClass = (result: string) => {
        const lowerResult = result.toLowerCase();
        if (lowerResult === 'malignant') return 'bg-red-100 text-red-800 border-red-200';
        if (lowerResult === 'benign') return 'bg-green-100 text-green-800 border-green-200';
        if (lowerResult === 'normal') return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };
    const resultColor = getResultClass(prediction.result);

    return (
        <div className="mt-4 pl-14">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-brand-text-primary uppercase tracking-widest">
                    Prediction: <span className={`ml-2 px-3 py-1 text-[10px] rounded-full border ${resultColor}`}>{prediction.result}</span>
                </p>
                <p className="text-[10px] text-brand-text-secondary font-black tracking-widest">CONFIDENCE: {(prediction.confidence * 100).toFixed(1)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className={`${confidenceColor} h-1.5 rounded-full transition-all duration-[1000ms]`} style={{ width: `${prediction.confidence * 100}%` }}></div>
            </div>
            {prediction.insight && (
                <p className="mt-3 text-[11px] text-slate-500 italic leading-relaxed">
                    "{prediction.insight}"
                </p>
            )}
        </div>
    );
};

const HistoAnalysis: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);


  const handleFiles = async (newFiles: File[]) => {
    const newUploads: UploadedFile[] = newFiles.map((file, index) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        const type = (extension === 'svs' || extension === 'tiff' || extension === 'png' || extension === 'jpg') ? extension : 'tiff';
        return {
            id: String(Date.now() + index),
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            status: 'Uploading',
            type: type as any,
            progress: 0,
        }
    });
    setFiles(prev => [...newUploads, ...prev]);
    
    for (const upload of newUploads) {
        const fileToUpload = newFiles.find(f => f.name === upload.name);
        if (!fileToUpload) continue;

        const formData = new FormData();
        formData.append("file", fileToUpload);

        try {
            const progressInterval = setInterval(() => {
                setFiles(currentFiles => currentFiles.map(f => {
                    if (f.id === upload.id && (f.progress || 0) < 90) {
                        return { ...f, progress: Math.min((f.progress || 0) + 10, 90) };
                    }
                    return f;
                }));
            }, 100);

            const response = await fetch(`/predict/histo/master`, {
                method: 'POST',
                body: formData,
            });
            
            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json().catch((): ErrorResponse => ({ detail: `Inference failed: ${response.statusText}` })) as ErrorResponse;
                throw new Error(errorData.detail || 'Analysis failed');
            }
             
            const result = await response.json() as HistoPrediction;
            setFiles(currentFiles => currentFiles.map(f => f.id === upload.id ? { ...f, status: 'Complete', progress: 100, prediction: result } : f));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Neural link failure.";
            setFiles(currentFiles => currentFiles.map(f => f.id === upload.id ? { ...f, status: 'Failed', progress: 100, errorMessage } : f));
        }
    }
  }

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, entering: boolean) => { e.preventDefault(); e.stopPropagation(); setIsDragging(entering); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };


  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2rem] shadow-subtle border border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-slate-50">
        <div>
            <h2 className="text-3xl font-black text-brand-text-primary tracking-tighter mb-2">Multi-Class Histo Analysis</h2>
            <p className="text-brand-text-secondary text-sm font-medium">Deploying the OncoScanAI Master model for multi-class histology inference.</p>
        </div>
        <div className="inline-flex items-center gap-3 rounded-3xl bg-brand-pink/10 border border-brand-pink/20 px-5 py-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-pink">Active Model</span>
            <span className="rounded-full bg-white px-4 py-2 text-[11px] font-bold text-brand-text-primary border border-gray-200">OncoScanAI Master</span>
        </div>
      </div>

      <div className="bg-white p-2 rounded-[2.5rem] shadow-subtle border border-gray-100 overflow-hidden">
        <div 
            onDragEnter={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragOver={(e) => handleDragEvents(e, true)} onDrop={handleDrop}
            className={`border-4 border-dashed rounded-[2rem] p-16 text-center transition-all duration-500 ${isDragging ? 'border-brand-pink bg-pink-50 scale-[0.98]' : 'border-gray-100 bg-white hover:bg-slate-50'}`}
        >
          <input type="file" id="histo-file-upload" className="hidden" multiple accept=".png,.jpg,.jpeg,.svs,.tiff" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
          <label htmlFor="histo-file-upload" className="cursor-pointer block group">
            <div className="w-20 h-20 bg-pink-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <UploadIcon className="w-10 h-10 text-brand-pink" />
            </div>
            <p className="text-xl font-black text-brand-text-primary tracking-tight">Drop Histology Scans Here</p>
            <p className="text-brand-pink font-black text-[10px] uppercase tracking-[0.2em] mt-2">or Click to Clinical Import</p>
          </label>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-subtle border border-gray-100">
        <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-brand-text-primary uppercase tracking-widest text-xs">Diagnostic Stream</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Inference</span>
        </div>
        {files.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <InfoIcon className="w-6 h-6 text-slate-200"/>
                </div>
                <p className="text-brand-text-secondary font-black text-[10px] uppercase tracking-widest">Waiting for clinical data input...</p>
            </div>
        ) : (
        <ul className="space-y-6">
          {files.map(file => (
            <li key={file.id} className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <FileIcon type={file.type} />
                <div className="flex-grow">
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-black text-brand-text-primary tracking-tight">{file.name}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest flex items-center px-3 py-1 rounded-full border ${
                          file.status === 'Complete' ? 'text-green-600 bg-green-50 border-green-100' : 
                          file.status === 'Failed' ? 'text-red-600 bg-red-50 border-red-100' : 'text-slate-400 bg-slate-50 border-slate-100'
                        }`}>
                          {file.status === 'Complete' && <CheckCircleIcon className="w-3 h-3 mr-1.5"/>}
                          {file.status === 'Failed' && <InfoIcon className="w-3 h-3 mr-1.5"/>}
                          {file.status === 'Uploading' ? 'Predicting...' : file.status}
                      </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all duration-500 ${file.status === 'Failed' ? 'bg-red-500' : 'bg-brand-pink'}`} style={{width: `${file.progress}%`}}></div>
                  </div>
                </div>
              </div>
              {file.status === 'Complete' && <PredictionResult prediction={file.prediction} />}
              {file.status === 'Failed' && (
                <div className="mt-4 pl-14">
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Error Report</p>
                    <p className="text-xs text-red-600 font-medium">{file.errorMessage}</p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
};

export default HistoAnalysis;
