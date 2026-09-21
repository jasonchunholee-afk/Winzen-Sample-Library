export type GarmentStatus = 'captured' | 'drafted' | 'approved' | 'needs_reshoot';

export interface PhotoRecord {
  file: string;
  role: 'front' | 'back' | 'detail' | 'label';
  component: string | null;
}

export interface AIFacetDraft {
  garment_type?: string;
  category?: string;
  gender?: string;
  fabric_family?: string;
  construction?: string;
  yarn?: string;
  colour_primary?: string;
  pattern?: string;
  brand_customer?: string;
  size_marked?: string;
  estimated_era?: string;
  free_text?: string;
}

export interface VersionRecord {
  v: number;
  source: 'ai' | 'human';
  by?: string;
  at: string;
  model_id?: string;
  prompt_id?: string;
  strategy?: 'A' | 'B';
  chose_strategy?: 'A' | 'B';
  facets: AIFacetDraft;
  tags: string[];
  free_text?: string;
  open_questions?: string[];
  corrected_fields?: string[];
  queries_dismissed?: string[];
  note?: string;
}

export interface GarmentSidecar {
  schema_version: number;
  code: string;
  box: string;
  status: GarmentStatus;
  captured: {
    by: string;
    at: string;
  };
  photos: PhotoRecord[];
  versions: VersionRecord[];
}
