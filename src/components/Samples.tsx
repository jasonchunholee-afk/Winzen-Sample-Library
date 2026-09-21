import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ZoomIn, Camera } from 'lucide-react';
import { ImageViewerModal } from './ImageViewerModal';
import { GarmentDetail } from './GarmentDetail';
import { compareGarmentsByYearAndCode } from '../utils/fileParsing';
import { useGridDisplay } from '../context/GridDisplayContext';
import { GridZoomControls } from './common/GridZoomControls';

export function Samples() {
  const { gridCols, yearSortOrder } = useGridDisplay();
  const [garments, setGarments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<any | null>(null);

  // Lightbox Modal for Double-Click Zoom
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState({ url: '', title: '', subtitle: '' });
  
  const [filters, setFilters] = useState({
    buyer: '',
    season: '',
    garment_type: '',
    fabric_material: '',
    fabric_yarn_count: '',
    fabric_construction: '',
    color: '',
    size: ''
  });

  const loadData = () => {
    fetch('/api/garments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = [...data].sort((a, b) => compareGarmentsByYearAndCode(a, b, yearSortOrder));
          setGarments(sorted);
          setResults(sorted);
        } else {
          return fetch('/garments_data.json')
            .then(res => res.json())
            .then(fallback => {
              if (Array.isArray(fallback)) {
                const sorted = [...fallback].sort((a, b) => compareGarmentsByYearAndCode(a, b, yearSortOrder));
                setGarments(sorted);
                setResults(sorted);
              }
            });
        }
      })
      .catch(() => {
        fetch('/garments_data.json')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              const sorted = [...data].sort((a, b) => compareGarmentsByYearAndCode(a, b, yearSortOrder));
              setGarments(sorted);
              setResults(sorted);
            }
          });
      });
  };

  useEffect(() => {
    loadData();
  }, [yearSortOrder]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Apply filters
    const filtered = garments.filter(g => {
      let matches = true;
      if (newFilters.buyer && g.buyer && !g.buyer.toLowerCase().includes(newFilters.buyer.toLowerCase())) matches = false;
      if (newFilters.season && g.season && !g.season.toLowerCase().includes(newFilters.season.toLowerCase())) matches = false;
      if (newFilters.garment_type && g.garment_type && !g.garment_type.toLowerCase().includes(newFilters.garment_type.toLowerCase())) matches = false;
      if (newFilters.fabric_material && g.fabric_material && !g.fabric_material.toLowerCase().includes(newFilters.fabric_material.toLowerCase())) matches = false;
      if (newFilters.fabric_yarn_count && g.fabric_yarn_count && !g.fabric_yarn_count.toLowerCase().includes(newFilters.fabric_yarn_count.toLowerCase())) matches = false;
      if (newFilters.fabric_construction && g.fabric_construction && !g.fabric_construction.toLowerCase().includes(newFilters.fabric_construction.toLowerCase())) matches = false;
      if (newFilters.color && g.color && !g.color.toLowerCase().includes(newFilters.color.toLowerCase())) matches = false;
      if (newFilters.size && g.size && !g.size.toLowerCase().includes(newFilters.size.toLowerCase())) matches = false;
      return matches;
    }).sort((a, b) => compareGarmentsByYearAndCode(a, b, yearSortOrder));
    setResults(filtered);
  };

  const handleOpenLightbox = (e: React.MouseEvent, garment: any) => {
    e.stopPropagation();
    const imgObj = garment.images?.[0];
    // Load raw/ tier on high-res zoom
    const fullUrl = imgObj?.rawUrl || imgObj?.fallbackUrl || `/images/${garment.id} (F).jpg`;
    setLightboxData({
      url: fullUrl,
      title: `${garment.id} — Full Resolution Archive (Raw Tier)`,
      subtitle: `${garment.buyer || garment.brand} • High-Res Lightbox`
    });
    setLightboxOpen(true);
  };

  const Field = ({ label, fieldKey, options }: { label: string, fieldKey: keyof typeof filters, options?: string[] }) => {
    const uniqueOptions = options || Array.from(new Set(garments.map(g => g[fieldKey]).filter(Boolean)));
    return (
      <div className="border border-neutral-300 relative group bg-white flex flex-col">
        <div className="bg-neutral-100 text-[10px] uppercase font-bold px-3 py-1.5 text-neutral-500 border-b border-neutral-300">
          {label}
        </div>
        <div className="relative flex-1 flex">
          <select 
            value={filters[fieldKey]}
            onChange={(e) => handleFilterChange(fieldKey as string, e.target.value)}
            className="w-full p-2.5 text-sm focus:outline-none bg-white text-neutral-900 appearance-none font-medium cursor-pointer"
          >
            <option value="">Any...</option>
            {uniqueOptions.map((opt: any, i: number) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  };

  if (selectedGarment) {
    return (
      <GarmentDetail
        garment={selectedGarment}
        onClose={() => {
          setSelectedGarment(null);
          loadData();
        }}
        onUpdated={loadData}
      />
    );
  }

  return (
    <>
      <ImageViewerModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxData.url}
        title={lightboxData.title}
        subtitle={lightboxData.subtitle}
      />

      <div className="w-full px-6 lg:px-8 xl:px-10 py-6 space-y-6">
        <div className="bg-white rounded-xl shadow-xs border border-neutral-200 overflow-hidden">
          <div className="p-5 border-b border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-neutral-400" />
              <h2 className="text-lg font-bold text-neutral-900">Advanced Specification Search</h2>
            </div>
            <span className="text-xs text-neutral-500 font-medium">Double-click garment cards to view full resolution photos</span>
          </div>
          
          <div className="p-6">
            <div className="text-center font-serif text-2xl tracking-widest font-bold mb-4 uppercase text-neutral-800">
              Winzen Apparel Limited
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[1px] border-[3px] border-neutral-900 bg-neutral-900 shadow-sm">
              <Field label="BUYER (客人)" fieldKey="buyer" />
              <Field label="SEASON (季節)" fieldKey="season" />
              <Field label="GARMENT TYPE (樣辦類型)" fieldKey="garment_type" />
              <Field label="COLOR (顏色)" fieldKey="color" />
              
              <Field label="YARN COUNT (紗支)" fieldKey="fabric_yarn_count" />
              <Field label="MATERIAL (成份)" fieldKey="fabric_material" />
              <Field label="CONSTRUCTION (織法)" fieldKey="fabric_construction" />
              <Field label="SIZE (尺碼)" fieldKey="size" />
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900 text-base">Archived Garments ({results.length})</h3>
              <span className="text-xs text-neutral-500">Click card for details • Double-click photo for full resolution</span>
            </div>
            <GridZoomControls showYearSort={true} />
          </div>

          <div 
            className="w-full grid gap-4 sm:gap-5 lg:gap-6 transition-all duration-300"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {results.map((garment) => {
              const visibleTags = (garment.hashtags || '')
                .split(',')
                .map((t: string) => t.trim())
                .filter(Boolean)
                .slice(0, 3);

              return (
                <div 
                  key={garment.id} 
                  onClick={() => setSelectedGarment(garment)}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col group"
                >
                  {/* Photo with double-click lightbox */}
                  <div 
                    className="aspect-[3/4] bg-neutral-100 relative overflow-hidden group cursor-zoom-in"
                    onDoubleClick={(e) => handleOpenLightbox(e, garment)}
                    title="Double-click for full resolution"
                  >
                    {garment.images?.length > 0 ? (
                      <img 
                        src={garment.images[0].thumbUrl || garment.images[0].url} 
                        alt={garment.id}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('images/')) {
                            target.src = garment.images[0].fallbackUrl || `/images/${garment.id} (F).jpg`;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50 border-2 border-dashed border-neutral-200">
                        <Camera className="w-8 h-8 text-neutral-300 mb-2" />
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pending Photo</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded backdrop-blur-xs flex items-center gap-1">
                        <ZoomIn className="w-3 h-3" /> Double-click Full Res
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-mono font-bold text-orange-600 mb-0.5">{garment.id}</div>
                      <h4 className="font-bold text-neutral-900 line-clamp-1">{garment.buyer || garment.brand || 'Unknown Buyer'}</h4>
                      <p className="text-xs font-medium text-neutral-600 line-clamp-1">{garment.garment_type}</p>
                      
                      {/* Hashtag chips */}
                      {visibleTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {visibleTags.map((tag: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium border border-blue-100">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>{garment.size || 'Size -'}</span>
                      <span>{garment.color || ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
