import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, MapPin, UploadCloud, 
  Layers, CheckCircle, Sparkles, Hash, AlertCircle, Camera, Tag,
  Zap, Brain, Scale, ShieldCheck, RefreshCw, XCircle
} from 'lucide-react';
import { GarmentDetail } from './GarmentDetail';
import { BulkUploader } from './BulkUploader';
import { PendingChangesModal } from './PendingChangesModal';
import { RetakeQueueViewer } from './capture/RetakeQueueViewer';
import { compareGarmentsByYearAndCode } from '../utils/fileParsing';
import { useGridDisplay } from '../context/GridDisplayContext';
import { GridZoomControls } from './common/GridZoomControls';

export function Review() {
  const { gridCols, yearSortOrder } = useGridDisplay();
  const [garments, setGarments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'library' | 'retake' | 'stickers' | 'all'>('pending');
  const [selectedGarment, setSelectedGarment] = useState<any | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  
  // Pending changes state
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Unanalyzed garments & FGD batch state
  const [unanalyzedCount, setUnanalyzedCount] = useState<number>(0);
  const [unanalyzedGarmentIds, setUnanalyzedGarmentIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [jobRunning, setJobRunning] = useState<boolean>(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const loadFgdStatus = () => {
    fetch(`/api/developer/fgd-test/garments-without-fgd?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.count === 'number') {
          setUnanalyzedCount(data.count);
          setUnanalyzedGarmentIds(data.garmentIds || []);
        }
      })
      .catch(err => console.warn("Failed to query garments without FGD:", err));

    fetch(`/api/developer/fgd-test/job/active?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.activeJob) {
          setActiveJob(data.activeJob);
          if (data.activeJob.status === 'running') {
            setJobRunning(true);
          }
        }
      })
      .catch(err => console.warn("Failed to check active FGD job:", err));
  };

  const loadGarments = () => {
    fetch(`/api/garments?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setGarments(data);
        }
      })
      .catch(err => console.error("Failed to load garments data:", err));

    fetch(`/api/pending-changes?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingCount(data.length);
        }
      })
      .catch(() => {});

    loadFgdStatus();
  };

  // Poll background FGD job when running
  useEffect(() => {
    if (!jobRunning) return;
    const interval = setInterval(() => {
      fetch(`/api/developer/fgd-test/job/status?_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.job) {
            setActiveJob(data.job);
            if (data.job.status !== 'running') {
              setJobRunning(false);
              loadGarments();
            }
          } else {
            setJobRunning(false);
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearInterval(interval);
  }, [jobRunning]);

  const handleRerunAllFgd = async () => {
    setActionErrorMessage(null);
    if (jobRunning) {
      setActionErrorMessage("An FGD batch job is already running. Please wait for it to finish or cancel it.");
      return;
    }
    const allIds = garments.map(g => g.id);
    if (allIds.length === 0) {
      setActionErrorMessage("No garments found in library to evaluate.");
      return;
    }
    try {
      setJobRunning(true);
      const res = await fetch('/api/developer/fgd-test/job/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: allIds,
          maxLoops: 1,
          isReviewRun: true
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
      }
    } catch (err: any) {
      setActionErrorMessage(`Could not start batch FGD: ${err.message}`);
      setJobRunning(false);
    }
  };

  const handleRunUnanalyzedFgd = async () => {
    setActionErrorMessage(null);
    if (jobRunning) {
      setActionErrorMessage("An FGD batch job is already running. Please wait for it to finish or cancel it.");
      return;
    }
    if (unanalyzedGarmentIds.length === 0) {
      setActionErrorMessage("All garments have already had an FGD evaluation!");
      return;
    }
    try {
      setJobRunning(true);
      const res = await fetch('/api/developer/fgd-test/job/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: unanalyzedGarmentIds,
          maxLoops: 1,
          isReviewRun: true
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
      }
    } catch (err: any) {
      setActionErrorMessage(`Could not start FGD for unanalyzed garments: ${err.message}`);
      setJobRunning(false);
    }
  };

  const handleCancelFgdJob = async () => {
    if (!activeJob?.id) return;
    try {
      await fetch('/api/developer/fgd-test/job/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJob.id })
      });
      setJobRunning(false);
      loadFgdStatus();
    } catch (err) {
      console.error("Failed to cancel FGD job:", err);
    }
  };

  const handleGarmentImageUpdated = (garmentId: string, imageInfo: any) => {
    setGarments(prev => {
      const exists = prev.some(g => g.id === garmentId);
      if (!exists) {
        // Newly added garment: fetch full fresh catalog
        loadGarments();
        return prev;
      }
      return prev.map(g => {
        if (g.id !== garmentId) return g;
        const existingImages = Array.isArray(g.images) ? [...g.images] : [];
        const index = existingImages.findIndex((img: any) => img.id === imageInfo.id || img.filename === imageInfo.filename);
        if (index >= 0) {
          existingImages[index] = { ...existingImages[index], ...imageInfo };
        } else {
          existingImages.push(imageInfo);
        }
        const roleOrder: Record<string, number> = { 'Front': 1, 'Back': 2, 'Label': 3 };
        existingImages.sort((a: any, b: any) => {
          const aOrder = a.isReview ? 50 : (roleOrder[a.role] || 10);
          const bOrder = b.isReview ? 50 : (roleOrder[b.role] || 10);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (Number(a.id) || 0) - (Number(b.id) || 0);
        });
        const updated = {
          ...g,
          images: existingImages
        };
        if (selectedGarment && selectedGarment.id === garmentId) {
          setSelectedGarment(updated);
        }
        return updated;
      });
    });
  };

  useEffect(() => {
    loadGarments();
  }, []);

  // Filter garments based on tab & search query (including visible & invisible hashtags)
  const filteredGarments = garments.filter(g => {
    if (activeTab === 'pending' && g.status === 'Approved') {
      if (!searchQuery) return false;
    }
    if (activeTab === 'library' && g.status !== 'Approved') {
      if (!searchQuery) return false;
    }
    if (activeTab === 'stickers') {
      const isStickerOrEquated = /^WZ[-_]/i.test(g.id) || !!g.previous_generated_code || /^(TEMP|UNTAGGED)/i.test(g.id);
      if (!isStickerOrEquated) return false;
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchId = g.id?.toLowerCase().includes(q);
    const matchPrevCode = g.previous_generated_code?.toLowerCase().includes(q);
    const matchBuyer = g.buyer?.toLowerCase().includes(q) || g.brand?.toLowerCase().includes(q);
    const matchType = g.garment_type?.toLowerCase().includes(q);
    const matchDesc = g.description?.toLowerCase().includes(q);
    const matchTags = g.hashtags?.toLowerCase().includes(q);
    const matchInvisible = g.invisible_hashtags?.toLowerCase().includes(q);

    return matchId || matchPrevCode || matchBuyer || matchType || matchDesc || matchTags || matchInvisible;
  }).sort((a, b) => compareGarmentsByYearAndCode(a, b, yearSortOrder));

  if (selectedGarment) {
    return (
      <GarmentDetail 
        garment={selectedGarment} 
        onClose={() => {
          setSelectedGarment(null);
          loadGarments();
        }}
        onUpdated={() => {
          loadGarments();
        }}
      />
    );
  }

  return (
    <>
      {showUploader && (
        <BulkUploader 
          onClose={() => { setShowUploader(false); loadGarments(); }} 
          onGarmentImageUpdated={handleGarmentImageUpdated}
        />
      )}
      
      {/* Pending Changes and Apply Approved Changes Workflow Modal */}
      <PendingChangesModal
        isOpen={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        onApplied={() => {
          loadGarments();
        }}
      />

      <div className="w-full px-6 lg:px-8 xl:px-10 py-6 space-y-6">
        
        {/* Two-Tier Toolbar */}
        <div className="space-y-4 border-b border-neutral-200 pb-4">
          {/* Top Tier: Tabs on left, Search & Grid controls on right */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-b lg:border-b-0 border-neutral-200 pb-3 lg:pb-0">
              <button
                onClick={() => setActiveTab('pending')}
                className={`text-base font-semibold pb-2 transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'pending' 
                    ? 'border-neutral-900 text-neutral-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Review Stage
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {garments.filter(g => g.status !== 'Approved').length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`text-base font-semibold pb-2 transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'library' 
                    ? 'border-neutral-900 text-neutral-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Approved Archive
                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold">
                  {garments.filter(g => g.status === 'Approved').length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('retake')}
                className={`text-base font-semibold pb-2 transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'retake' 
                    ? 'border-amber-600 text-amber-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Camera className="w-4 h-4 text-amber-600" />
                <span>Capture Retake Queue</span>
                {garments.filter(g => g.status === 'needs_reshoot' || g.status === 'needs_retake').length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {garments.filter(g => g.status === 'needs_reshoot' || g.status === 'needs_retake').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('stickers')}
                className={`text-base font-semibold pb-2 transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'stickers' 
                    ? 'border-amber-600 text-amber-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Tag className="w-4 h-4 text-amber-600" />
                <span>Missing Labels / Equated</span>
                {garments.filter(g => /^WZ[-_]/i.test(g.id) || !!g.previous_generated_code || /^(TEMP|UNTAGGED)/i.test(g.id)).length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {garments.filter(g => /^WZ[-_]/i.test(g.id) || !!g.previous_generated_code || /^(TEMP|UNTAGGED)/i.test(g.id)).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`text-base font-semibold pb-2 transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'all' 
                    ? 'border-neutral-900 text-neutral-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                All Garments
                <span className="bg-neutral-100 text-neutral-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {garments.length}
                </span>
              </button>
            </div>
            
            {/* Search and Grid Controls */}
            <div className="flex items-center gap-3 self-end lg:self-center w-full lg:w-auto justify-between lg:justify-end">
              <div className="relative flex-1 lg:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search specs, #hashtags, rules..."
                  className="pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 w-full"
                />
              </div>
              
              <GridZoomControls showYearSort={true} />
            </div>
          </div>

          {/* Action Ribbon: Horizontal flex container for upload, pending queue, and batch FGD triggers */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button 
                onClick={() => setShowUploader(true)} 
                className="px-3.5 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Batch
              </button>

              {/* Pending Queue Activation button */}
              <button
                onClick={() => setPendingModalOpen(true)}
                className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
                title="Review pending modifications and run 'Apply Approved Changes'"
              >
                <Layers className="w-4 h-4 text-orange-600" />
                <span>Pending Changes Queue</span>
                {pendingCount > 0 && (
                  <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Re-run FGD for all garments */}
              <button
                id="btn-rerun-all-fgd"
                onClick={handleRerunAllFgd}
                disabled={jobRunning || garments.length === 0}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 border border-purple-200 text-purple-900 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title="Re-run FGD evaluation for all garments in library"
              >
                <RefreshCw className={`w-4 h-4 text-purple-600 ${jobRunning ? 'animate-spin' : ''}`} />
                <span>Re-run FGD for all garments</span>
                <span className="bg-purple-200 text-purple-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {garments.length}
                </span>
              </button>

              {/* Run FGD for garments that never had an FGD */}
              <button
                id="btn-run-unanalyzed-fgd"
                onClick={handleRunUnanalyzedFgd}
                disabled={jobRunning || unanalyzedCount === 0}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 border border-indigo-200 text-indigo-900 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title={unanalyzedCount > 0 ? `Run FGD for ${unanalyzedCount} garment(s) that have never had an FGD run` : "All garments have had an FGD evaluation"}
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Run FGD for unanalyzed garments</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${unanalyzedCount > 0 ? 'bg-indigo-600 text-white' : 'bg-indigo-200 text-indigo-700'}`}>
                  {unanalyzedCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Error Message Banner */}
        {actionErrorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-sm text-rose-800 animate-in fade-in duration-200 shadow-xs">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionErrorMessage}</span>
            </div>
            <button
              onClick={() => setActionErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Active FGD Job Banner */}
        {activeJob && activeJob.status === 'running' && (
          <div 
            id="fgd-active-progress-banner"
            className="bg-purple-50/90 border border-purple-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-purple-950 text-sm">
                    Analyzing {(activeJob.currentGarmentIndex ?? 0) + 1} of {activeJob.totalGarments || garments.length}...
                  </span>
                  {activeJob.totalGarments > 0 && (
                    <span className="text-xs font-mono font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {Math.round(((activeJob.currentGarmentIndex ?? 0) + 1) / (activeJob.totalGarments || 1) * 100)}%
                    </span>
                  )}
                </div>
                <div className="text-xs text-purple-800 truncate mt-0.5">
                  {activeJob.currentGarmentId && (
                    <span className="font-semibold">[{activeJob.currentGarmentId}] </span>
                  )}
                  <span>{activeJob.currentStepDescription || activeJob.currentStep || 'Analyzing visual label and garment attributes...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                id="btn-cancel-fgd-job"
                onClick={handleCancelFgdJob}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Cancel current FGD batch evaluation"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* Informative Header Banner */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span>
              <strong>Review Stage UX:</strong> Fast 400px thumbnail rendering in multi-garment view. Click any card to open its detail view; double-click the photo inside detail view to call forward full-resolution raw archive photos.
            </span>
          </div>
          <button
            onClick={() => setPendingModalOpen(true)}
            className="text-neutral-900 font-bold hover:underline whitespace-nowrap"
          >
            Open Pending Queue →
          </button>
        </div>

        {/* Retake Queue Worklist View (Capture Coordination) */}
        {activeTab === 'retake' && (
          <div className="space-y-4">
            <RetakeQueueViewer
              onSelectGarment={(gId) => {
                const target = garments.find(g => g.id === gId);
                if (target) setSelectedGarment(target);
              }}
            />
          </div>
        )}

        {/* Garment Grid */}
        {activeTab !== 'retake' && (
          <div 
            className="w-full grid gap-4 sm:gap-5 lg:gap-6 transition-all duration-300"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
          {filteredGarments.map(garment => {
            const visibleTags = (garment.hashtags || '')
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
              .slice(0, 4);

            return (
              <div 
                key={garment.id}
                onClick={() => setSelectedGarment(garment)} 
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer flex flex-col hover:border-neutral-300"
              >
                {/* Thumbnail Image Section */}
                <div 
                  className="aspect-[4/5] bg-neutral-100 relative overflow-hidden group"
                >
                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-0.5 rounded shadow-sm z-10 ${
                    garment.status === 'Approved' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    {garment.status === 'Approved' ? 'Approved' : 'Review'}
                  </div>

                  {/* Alternative / Review Shot Badge */}
                  {garment.images?.some((img: any) => img.isReview || img.role?.includes('Review')) && (
                    <div className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>Review Shot</span>
                    </div>
                  )}

                  {(() => {
                    const cardImage = garment.images?.find((img: any) => img.role === 'Front')
                      || garment.images?.find((img: any) => img.role === 'Back')
                      || garment.images?.find((img: any) => img.role === 'Label')
                      || garment.images?.[0];
                    const cardImgUrl = cardImage?.thumbUrl || cardImage?.url || (cardImage?.filename ? `/images_thumb/${cardImage.filename}` : `/images_thumb/${garment.id} (F).jpg`);
                    const cardFallback = cardImage?.fallbackUrl || cardImage?.rawUrl || `/images/${garment.id} (F).jpg`;

                    return (
                      <img 
                        src={cardImgUrl} 
                        alt={`${garment.buyer || garment.brand} - ${garment.id}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src.includes('images_thumb') || target.src.includes('images_ai')) {
                            target.src = cardFallback;
                          } else {
                            target.onerror = null; 
                            target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="%23f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="%23a3a3a3">Pending Photo</text><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23737373">${garment.id}</text></svg>`;
                          }
                        }}
                      />
                    );
                  })()}
                </div>
                
                {/* Details Section */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-xs font-mono font-bold text-orange-600 block">{garment.id}</span>
                        {garment.previous_generated_code && (
                          <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded" title={`Equated from previous code: ${garment.previous_generated_code}`}>
                            Equated from: {garment.previous_generated_code}
                          </span>
                        )}
                        {/^WZ[-_]/i.test(garment.id) && !garment.previous_generated_code && (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                            Sticker Tag
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-neutral-900 leading-tight line-clamp-1">
                        {garment.buyer || garment.brand}
                      </h3>
                      <p className="text-xs font-medium text-neutral-600 mt-0.5 line-clamp-1">
                        {garment.garment_type || 'Garment'}
                      </p>
                    </div>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {garment.size && (
                        <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded font-medium">
                          {garment.size}
                        </span>
                      )}
                      {garment.gnw_weight && (
                        <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded font-medium">
                          {garment.gnw_weight}
                        </span>
                      )}
                      {visibleTags.map((tag: string, i: number) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium border border-blue-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3">
                      {garment.description || garment.jennifer_emulator_raw || garment.fabric_raw}
                    </p>

                    {/* Director Jason's Commentary Preview */}
                    {garment.director_comment && (
                      <div className="mb-2.5 p-2 rounded-lg bg-purple-50/90 border border-purple-200 text-xs">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-purple-900 flex items-center gap-1 text-[11px]">
                            <Scale className="w-3 h-3 text-purple-700" /> Jason's Note
                          </span>
                          {garment.director_comment_record?.flash_evaluation && (
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              garment.director_comment_record.flash_evaluation.cleared
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {garment.director_comment_record.flash_evaluation.cleared ? 'Flash: Cleared' : 'Flash: Review'}
                            </span>
                          )}
                          {garment.director_comment_record?.pro_arbitration && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                              Pro: Arbitrated
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-700 line-clamp-2 text-[11px] leading-snug">
                          {garment.director_comment}
                        </p>
                      </div>
                    )}

                    {/* FGD Unresolved Discrepancies Preview (if no director comment yet) */}
                    {garment.reviewer_feedback && !garment.director_comment && (
                      <div className="mb-2.5 p-2 rounded-lg bg-amber-50/90 border border-amber-200 text-xs">
                        <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px] mb-1">
                          <AlertCircle className="w-3 h-3 text-amber-700" /> FGD Questions for Review
                        </span>
                        <p className="text-neutral-700 line-clamp-2 text-[11px] leading-snug">
                          {garment.reviewer_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer / Location */}
                  <div className="pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{garment.location || 'Vault — 0001'}</span>
                      </div>
                      <span className="text-neutral-400 font-mono text-[10px]">
                        {garment.summaries?.length ? `v${garment.summaries.length} Archival` : ''}
                      </span>
                    </div>

                    {/* Senior Merchandiser Jennifer: Final Approval Authority */}
                    {garment.status !== 'Approved' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            if (res.ok) {
                              loadGarments();
                            }
                          } catch {}
                        }}
                        className="w-full mt-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Senior Merchandiser Jennifer: Approve garment and move to Active Library"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                        <span>Approve & Move to Library</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}

        {activeTab !== 'retake' && filteredGarments.length === 0 && (
          <div className="text-center py-16 bg-white border border-neutral-200 rounded-2xl">
            <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <h3 className="font-bold text-neutral-700">No garments match criteria</h3>
            <p className="text-xs text-neutral-400 mt-1">Try clearing your search or switching tabs.</p>
          </div>
        )}

      </div>
    </>
  );
}
