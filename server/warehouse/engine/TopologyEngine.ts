import crypto from 'crypto';
import { type WarehouseLocationRecord } from '../warehouseDb';

export interface CabinetConfig {
  cabinetNo: string;
  shelvesCount: number;
  stacksPerShelf: number;
  preset: 'HUGO_BOSS_STANDARD' | 'CUSTOM' | 'UNPARTITIONED';
  customShelves?: Array<{
    shelfNo: number;
    buyer: string;
    type: string;
    capacity: number;
  }>;
}

export interface AreaGenerationOptions {
  closeStack5InB?: boolean;
}

export interface TrackDefinition {
  trackCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  trackIndex: number; // 1 to 6
  name: string;
  cabinetCount: number;
  description: string;
}

export const WAREHOUSE_TRACKS: TrackDefinition[] = [
  { trackCode: 'A', trackIndex: 1, name: 'Track A', cabinetCount: 11, description: 'Track 1 of 6: 11 single-side faces (A1-A2 2-stacks, A3-A11 3-stacks)' },
  { trackCode: 'B', trackIndex: 2, name: 'Track B', cabinetCount: 10, description: 'Track 2 of 6: 10 single-side faces (5 shelves, unpartitioned bay, 5 stacks)' },
  { trackCode: 'C', trackIndex: 3, name: 'Track C', cabinetCount: 9, description: 'Track 3 of 6: 9 single-side faces (C1-C8 standard, C9 unpartitioned bay)' },
  { trackCode: 'D', trackIndex: 4, name: 'Track D', cabinetCount: 11, description: 'Track 4 of 6: 11 single-side faces (Standard 3-stacks)' },
  { trackCode: 'E', trackIndex: 5, name: 'Track E', cabinetCount: 10, description: 'Track 5 of 6: 10 single-side faces (Standard 3-stacks)' },
  { trackCode: 'F', trackIndex: 6, name: 'Track F', cabinetCount: 8, description: 'Track 6 of 6: 8 single-side faces (Standard 3-stacks)' },
];

/**
 * TopologyEngine
 * 
 * Exclusively responsible for physical warehouse structural definitions,
 * capacity math, and partitioning logic across the 6 physical floor tracks (A–F).
 * Generates and validates structural location blueprint data independently of database persistence.
 */
export class TopologyEngine {
  private static instance: TopologyEngine;

  private constructor() {}

  public static getInstance(): TopologyEngine {
    if (!TopologyEngine.instance) {
      TopologyEngine.instance = new TopologyEngine();
    }
    return TopologyEngine.instance;
  }

  /**
   * Generates bulk locations for an entire designated Area (e.g. A, B, C).
   * It enforces specific physical stacking constraints for non-standard cabinets.
   */
  public generateArea(areaCode: string, options: AreaGenerationOptions = {}): WarehouseLocationRecord[] {
    const area = areaCode.toUpperCase().trim();
    let cabinetCount = 0;

    switch (area) {
      case 'A': cabinetCount = 11; break;
      case 'B': cabinetCount = 10; break;
      case 'C': cabinetCount = 9; break;
      case 'D': cabinetCount = 11; break;
      case 'E': cabinetCount = 10; break;
      case 'F': cabinetCount = 8; break;
      default: throw new Error(`Unknown area code: ${area}`);
    }

    const allLocations: WarehouseLocationRecord[] = [];

    for (let i = 1; i <= cabinetCount; i++) {
      const cabinetNo = `${area}${i}`;
      let stacksPerShelf = 3;
      let shelvesCount = 10;
      let preset: 'HUGO_BOSS_STANDARD' | 'CUSTOM' | 'UNPARTITIONED' = 'HUGO_BOSS_STANDARD';

      // Constraint 3.1: A1-A2, each shelf can only hold two stacks (10 shelves = 20 stacks)
      if (cabinetNo === 'A1' || cabinetNo === 'A2') {
        stacksPerShelf = 2;
        shelvesCount = 10;
      }
      // Constraint 3.2: B1-10 not partitioned vertically, 5 shelves high, 5 stacks (optionally 4) = 25 (or 20) stacks
      else if (area === 'B') {
        stacksPerShelf = options.closeStack5InB ? 4 : 5;
        preset = 'UNPARTITIONED';
        shelvesCount = 5;
      }
      // Constraint 3.3: C9 not partitioned vertically, 5 shelves high, holds 3 stacks = 15 stacks
      else if (cabinetNo === 'C9') {
        stacksPerShelf = 3;
        preset = 'UNPARTITIONED';
        shelvesCount = 5;
      }

      const cabinetLocations = this.generateCabinetLocations({
        cabinetNo,
        shelvesCount,
        stacksPerShelf,
        preset
      });

      allLocations.push(...cabinetLocations);
    }

    return allLocations;
  }

  /**
   * Helper to retrieve standard physical architecture configuration for any given cabinet.
   */
  public getDefaultCabinetConfig(cabinetNo: string, options: AreaGenerationOptions = {}): { shelvesCount: number; stacksPerShelf: number; preset: 'HUGO_BOSS_STANDARD' | 'CUSTOM' | 'UNPARTITIONED' } {
    const cab = cabinetNo.toUpperCase().trim();
    if (cab === 'A1' || cab === 'A2') {
      return { shelvesCount: 10, stacksPerShelf: 2, preset: 'HUGO_BOSS_STANDARD' };
    }
    if (cab.startsWith('B')) {
      return { shelvesCount: 5, stacksPerShelf: options.closeStack5InB ? 4 : 5, preset: 'UNPARTITIONED' };
    }
    if (cab === 'C9') {
      return { shelvesCount: 5, stacksPerShelf: 3, preset: 'UNPARTITIONED' };
    }
    return { shelvesCount: 10, stacksPerShelf: 3, preset: 'HUGO_BOSS_STANDARD' };
  }

  /**
   * Generates a complete physical topology for a cabinet.
   * Does NOT interact with the database, only returns valid record objects.
   */
  public generateCabinetLocations(config: CabinetConfig): WarehouseLocationRecord[] {
    const locations: WarehouseLocationRecord[] = [];
    const timestamp = new Date().toISOString();

    // Standardize input
    const cabinetId = config.cabinetNo.toUpperCase().trim();

    for (let shelf = 1; shelf <= config.shelvesCount; shelf++) {
      let buyer = 'Unassigned';
      let type = 'All';
      let capacity = 12;

      if (config.preset === 'HUGO_BOSS_STANDARD') {
        const standardConfig = this.getStandardShelfConfig(shelf);
        buyer = standardConfig.buyer;
        type = standardConfig.type;
        capacity = standardConfig.capacity;
      } else if (config.preset === 'UNPARTITIONED') {
        buyer = 'General / Unassigned';
        type = 'All';
        capacity = 12;
      } else if (config.customShelves) {
        const custom = config.customShelves.find(c => c.shelfNo === shelf);
        if (custom) {
          buyer = custom.buyer;
          type = custom.type;
          capacity = custom.capacity;
        }
      }

      for (let stack = 1; stack <= config.stacksPerShelf; stack++) {
        const locationCode = `${cabinetId}-${shelf}-${stack}`;
        
        locations.push({
          id: crypto.randomUUID(),
          location_code: locationCode,
          location_name: `Cabinet ${cabinetId} • Shelf ${shelf} • Stack ${stack}`,
          cabinet_no: cabinetId,
          shelf_no: shelf,
          stack_no: stack,
          assigned_buyer: buyer,
          assigned_type: type,
          max_capacity_units: capacity,
          current_count: 0,
          pending_assigned_count: 0,
          is_full: 0,
          is_active: 1,
          fullness_level: 'EMPTY',
          stack_width_cm: 26,
          stack_depth_cm: 40,
          is_partitioned: config.preset === 'UNPARTITIONED' ? 0 : 1,
          is_closed: 0,
          assignment_mode: 'Manual',
          created_at: timestamp,
          updated_at: timestamp
        });
      }
    }

    return locations;
  }

  /**
   * Single source of truth for Hugo Boss dual-partition architecture constraints
   */
  private getStandardShelfConfig(shelfNo: number): { buyer: string, type: string, capacity: number } {
    switch (shelfNo) {
      // Left Partition: BOSS Pillar
      case 1: return { buyer: 'BOSS', type: 'Polos & T-Shirts', capacity: 16 };
      case 2: return { buyer: 'BOSS', type: 'Sweaters & Knitwear', capacity: 14 };
      case 3: return { buyer: 'BOSS', type: 'Pants & Bottoms', capacity: 14 };
      case 4: return { buyer: 'BOSS', type: 'Jackets & Outerwear', capacity: 6 };
      case 5: return { buyer: 'BOSS', type: 'Suiting & Tailoring', capacity: 6 };
      // Right Partition: HUGO Pillar
      case 6: return { buyer: 'HUGO', type: 'Graphic Tees & Polos', capacity: 16 };
      case 7: return { buyer: 'HUGO', type: 'Hoodies & Sweatshirts', capacity: 12 };
      case 8: return { buyer: 'HUGO', type: 'Denim & Street Pants', capacity: 14 };
      case 9: return { buyer: 'HUGO', type: 'Casual Jackets & Outerwear', capacity: 8 };
      case 10: return { buyer: 'Overflow / General', type: 'Archive & Overflow', capacity: 14 };
      default: return { buyer: 'General', type: 'All', capacity: 12 };
    }
  }

  /**
   * Helper to identify if a location code is structurally valid (e.g., A3-1-1)
   */
  public isValidLocationCode(code: string): boolean {
    const regex = /^[A-Z0-9]+-\d+-\d+$/;
    return regex.test(code.toUpperCase());
  }

  /**
   * Utility to parse location components safely
   */
  public parseLocationCode(code: string): { cabinetNo: string, shelfNo: number, stackNo: number } | null {
    if (!this.isValidLocationCode(code)) return null;
    const parts = code.toUpperCase().split('-');
    return {
      cabinetNo: parts[0],
      shelfNo: parseInt(parts[1], 10),
      stackNo: parseInt(parts[2], 10)
    };
  }
}

export const topologyEngine = TopologyEngine.getInstance();
