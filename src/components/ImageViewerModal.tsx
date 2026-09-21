import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
}

export function ImageViewerModal({ isOpen, onClose, imageUrl, title, subtitle }: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-neutral-900/80 border-b border-neutral-800 text-white z-10">
        <div className="flex items-center gap-3">
          <span className="bg-orange-500 text-white font-bold text-xs px-2.5 py-1 rounded">
            Full Resolution
          </span>
          <div>
            <h2 className="font-bold text-base text-neutral-100">{title}</h2>
            {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs text-neutral-400 font-mono w-14 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button 
            onClick={handleReset}
            title="Reset Zoom"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors ml-1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-neutral-700 mx-2" />
          <button 
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline pr-1">Close</span>
          </button>
        </div>
      </div>

      {/* Image Canvas Container */}
      <div 
        className={`flex-1 overflow-hidden flex items-center justify-center p-4 relative ${scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleZoomIn}
      >
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl rounded-sm pointer-events-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src.includes('images/')) {
                target.src = target.src.replace('/images/', '/images_ai/');
              }
            }}
          />
        ) : (
          <div className="text-neutral-400 text-sm">No image available</div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-6 py-2.5 bg-neutral-900/80 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
        <span>Tip: Double-click or scroll to zoom in. Click and drag to pan high-res details.</span>
        <span>Press <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 text-[10px]">Esc</kbd> to exit</span>
      </div>
    </div>
  );
}
