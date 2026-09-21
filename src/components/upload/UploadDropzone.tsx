import React from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadDropzoneProps {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowseClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * UploadDropzone - Drag & drop target with file selector trigger
 */
export function UploadDropzone({
  onDragOver,
  onDrop,
  onBrowseClick,
  fileInputRef,
  onFileSelect,
}: UploadDropzoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onBrowseClick}
      className="border-2 border-dashed border-neutral-300 hover:border-indigo-400 bg-neutral-50/50 hover:bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
    >
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={onFileSelect}
      />
      <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-neutral-200 flex items-center justify-center group-hover:scale-105 transition-transform">
        <UploadCloud className="w-6 h-6 text-indigo-600" />
      </div>
      <div>
        <p className="font-semibold text-sm text-neutral-900">
          Click to browse or drag photos here
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Automatically detects Garment ID and Front, Back, or Label angle from filename
        </p>
      </div>
    </div>
  );
}
