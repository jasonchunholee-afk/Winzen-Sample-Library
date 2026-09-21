import React from 'react';
import { CheckCircle, Loader2, AlertCircle, RefreshCw, Trash2, Image as ImageIcon } from 'lucide-react';
import { BatchItem } from '../../services/BatchUploadManager';

export interface UploadItemRowProps {
  key?: React.Key;
  item: BatchItem;
  garmentsList: { id: string; buyer?: string }[];
  isUploading: boolean;
  onUpdateRole: (role: 'Front' | 'Back' | 'Label') => void;
  onUpdateGarmentId: (garmentId: string) => void;
  onRetry: () => void;
  onRemove: () => void;
}

export function UploadItemRow({
  item,
  garmentsList,
  isUploading,
  onUpdateRole,
  onUpdateGarmentId,
  onRetry,
  onRemove
}: UploadItemRowProps) {
  const isLabel = item.role === 'Label';
  const roleBadgeColor = 
    item.role === 'Front' ? 'bg-blue-50 text-blue-700 border-blue-200' :
    item.role === 'Back' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
    'bg-purple-50 text-purple-700 border-purple-200';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100/80 rounded-xl border transition-colors gap-3 ${
      item.status === 'processing' ? 'border-indigo-300 bg-indigo-50/20' : 
      item.status === 'failed' ? 'border-rose-300 bg-rose-50/20' : 
      item.status === 'success' ? 'border-emerald-300 bg-emerald-50/20' : 'border-neutral-200'
    }`}>
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
          {item.uploadedUrl ? (
            <img src={item.uploadedUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-neutral-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-neutral-900 truncate" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {(item.file.size / (1024 * 1024)).toFixed(1)} MB
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border uppercase tracking-wider ${roleBadgeColor}`}>
              {item.role}
            </span>
          </div>

          {/* Progress or Status Label */}
          <div className="mt-1 flex items-center gap-2">
            {item.status === 'processing' && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{item.chunkProgress || 'Uploading packets...'}</span>
              </div>
            )}
            {item.status === 'failed' && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium truncate" title={item.error}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{item.error || 'Upload failed'}</span>
              </div>
            )}
            {item.status === 'success' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{item.chunkProgress || 'Uploaded & Synced'}</span>
              </div>
            )}
            {item.status === 'pending' && (
              <span className="text-xs text-neutral-500">Ready in queue</span>
            )}
          </div>

          {/* Progress bar */}
          {item.status === 'processing' && item.progressPercent !== undefined && (
            <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-indigo-600 h-full transition-all duration-200"
                style={{ width: `${item.progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Selectors & Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
        {/* Garment ID Selector */}
        <select
          value={item.garmentId}
          disabled={item.status === 'processing' || isUploading}
          onChange={(e) => onUpdateGarmentId(e.target.value)}
          className="text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono font-medium max-w-[150px] truncate"
        >
          {garmentsList.map(g => (
            <option key={g.id} value={g.id}>
              {g.id} {g.buyer ? `(${g.buyer})` : ''}
            </option>
          ))}
        </select>

        {/* Role Selector */}
        <select
          value={item.role}
          disabled={item.status === 'processing' || isUploading}
          onChange={(e) => onUpdateRole(e.target.value as any)}
          className="text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
        >
          <option value="Front">Front</option>
          <option value="Back">Back</option>
          <option value="Label">Label</option>
        </select>

        {/* Retry or Remove Buttons */}
        {item.status === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isUploading}
            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            title="Retry this file"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={item.status === 'processing'}
          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          title="Remove from queue"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
