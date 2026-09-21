import React from 'react';
import { BatchSyncModal, BatchSyncModalProps } from './sync/BatchSyncModal';

export interface BulkUploaderProps extends BatchSyncModalProps {}

/**
 * BulkUploader
 * 
 * Clean GUI View Coordinator wrapping the BatchSyncModal.
 * Provides File System Access API 2-way sync, direct ingestion, and quality triage quarantine.
 */
export function BulkUploader(props: BulkUploaderProps) {
  return <BatchSyncModal {...props} />;
}
