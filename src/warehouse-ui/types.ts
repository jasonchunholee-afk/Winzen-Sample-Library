export interface WarehouseGarment {
  id: string;
  buyer: string | null;
  garment_type: string | null;
  season: string | null;
  thumb_url: string | null;
  shelving_status: string | null;
  assigned_location?: string | null;
  temp_container?: string | null;
  created_at?: string | null;
}

export interface WarehouseLocationItem {
  id: number;
  cabinet_no: string;
  shelf_no: number;
  stack_no: number;
  location_code: string;
  location_name: string | null;
  assigned_buyer: string | null;
  assigned_year: string | null;
  assigned_type: string | null;
  max_capacity_units: number;
  current_count: number;
  pending_assigned_count: number;
  is_full: number;
  fullness_level: 'EMPTY' | 'AVAILABLE' | 'NEAR_FULL' | 'FULL' | 'OVERFLOW' | string;
  full_evidence_notes: string | null;
  last_inspected_at: string | null;
  last_photo_url: string | null;
  notes: string | null;
  stack_width_cm?: number;
  stack_depth_cm?: number;
  is_partitioned?: number;
  is_closed?: number;
  is_active?: number;
  assignment_mode?: 'Manual' | 'Auto';
  garments: WarehouseGarment[];
}

export interface UnshelfedGarmentItem {
  id: string;
  buyer: string | null;
  garment_type: string | null;
  season: string | null;
  assigned_location: string | null;
  temp_container: string | null;
  created_at: string | null;
  thumb_url: string | null;
}

export interface FullnessInspectionResult {
  locationCode: string;
  isFull: boolean;
  fullnessLevel: 'EMPTY' | 'AVAILABLE' | 'NEAR_FULL' | 'FULL' | 'OVERFLOW';
  estimatedGarmentCount: number;
  detectedGarmentType: string;
  capacityPercentage: number;
  confidence: number;
  reasoning: string;
  detectedOcrLabels: string[];
  photoUrl?: string;
}
