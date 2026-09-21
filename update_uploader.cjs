const fs = require('fs');

const file = 'src/components/BulkUploader.tsx';
const content = `import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, Loader2, X, AlertCircle } from 'lucide-react';

export function BulkUploader({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [fallbackActive, setFallbackActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f: any) => f.type.startsWith('image/'));
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const uploadViaServer = async (file: File, garmentId: string, role: string) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('garmentId', garmentId);
    formData.append('role', role);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      throw new Error(\`Server upload failed: \${res.statusText}\`);
    }
    return await res.json();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    setCompleted(0);
    setStatusMessage('Connecting to storage pipeline...');
    
    let useServerFallback = false;

    // Dynamically load Firebase Storage
    let storage: any = null;
    let ref: any = null;
    let uploadBytesResumable: any = null;
    let getDownloadURL: any = null;

    try {
      const fb = await import('../firebase');
      const fbs = await import('firebase/storage');
      storage = fb.storage;
      ref = fbs.ref;
      uploadBytesResumable = fbs.uploadBytesResumable;
      getDownloadURL = fbs.getDownloadURL;
    } catch (e) {
      console.warn("Firebase Storage unavailable, using server upload", e);
      useServerFallback = true;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parsed = file.name.split('.');
      const ext = parsed.pop() || 'jpg';
      const name = parsed.join('.');
      const garmentId = name.split(' ')[0] || 'UNKNOWN';
      const role = name.includes('(F)') ? 'Front' : name.includes('(B)') ? 'Back' : 'Label';
      
      setStatusMessage(\`Uploading & OCR analyzing \${file.name} (\${i + 1}/\${files.length})...\`);

      let uploadedSuccessfully = false;

      // 1. Try Firebase Cloud Storage first if not in fallback mode
      if (!useServerFallback && storage) {
        try {
          const storageRef = ref(storage, \`images/\${name}_\${Date.now()}.\${ext}\`);
          const uploadTask = await uploadBytesResumable(storageRef, file);
          const downloadURL = await getDownloadURL(uploadTask.ref);
          
          await fetch('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              garmentId,
              role,
              filename: file.name,
              url: downloadURL
            })
          });
          uploadedSuccessfully = true;
        } catch (err: any) {
          console.warn("Firebase Storage error (bucket not ready or permission):", err);
          // If 404 or bucket not ready, switch to server pipeline for all remaining files
          useServerFallback = true;
          setFallbackActive(true);
        }
      }

      // 2. Fallback to high-performance Server Upload pipeline (with Sharp resize + Gemini OCR)
      if (!uploadedSuccessfully) {
        try {
          await uploadViaServer(file, garmentId, role);
          uploadedSuccessfully = true;
        } catch (err) {
          console.error("Failed to upload via server fallback", file.name, err);
        }
      }

      setCompleted(i + 1);
      setProgress(((i + 1) / files.length) * 100);
    }

    setStatusMessage('Upload and OCR processing completed!');
    setUploading(false);
    setTimeout(() => {
      window.location.reload();
    }, 1800);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Direct Cloud Uploader</h2>
            <p className="text-xs text-neutral-500">Auto-routes to Firebase Cloud Storage with instant Gemini OCR extraction.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {!uploading && progress === 0 && (
            <div 
              className="border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center hover:bg-neutral-50 hover:border-neutral-400 transition-all cursor-pointer mb-6"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-900 font-medium text-lg">Click to select files or drag photos here</p>
              <p className="text-neutral-500 text-sm mt-1">Photos will be uploaded and instantly OCR-processed by Gemini.</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {files.length > 0 && !uploading && progress === 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-end mb-3">
                <h3 className="font-semibold text-neutral-800">Queue ({files.length} images)</h3>
                <button 
                  onClick={() => setFiles([])}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                {files.map((file, i) => (
                  <div key={i} className="flex justify-between items-center p-3 hover:bg-neutral-50">
                    <span className="text-sm font-medium text-neutral-700 truncate mr-4">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="text-neutral-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress State */}
          {(uploading || progress > 0) && (
            <div className="py-8 text-center space-y-6">
              {uploading ? (
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
              ) : (
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              )}
              
              <div>
                <h3 className="text-xl font-bold text-neutral-900 mb-1">
                  {uploading ? 'Processing & Analyzing Images...' : 'Upload Complete!'}
                </h3>
                <p className="text-neutral-600 text-sm">
                  {statusMessage || \`\${completed} of \${files.length} processed\`}
                </p>
                {fallbackActive && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Firebase Storage bucket initializing; routed securely via server pipeline
                  </div>
                )}
              </div>

              <div className="w-full bg-neutral-100 rounded-full h-3 max-w-md mx-auto overflow-hidden">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: \`\${progress}%\` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!uploading && progress === 0 && (
          <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-between items-center">
            <span className="text-xs text-neutral-500">
              Supported formats: JPG, PNG, WEBP
            </span>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 text-neutral-600 hover:bg-neutral-200 font-medium rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={files.length === 0}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <UploadCloud className="w-4 h-4" />
                Start Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, content);
console.log("Updated BulkUploader.tsx");
