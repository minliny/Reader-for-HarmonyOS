// Shared projections for the original-operation recovery surface.
export interface ReaderLibrarySyncCounts { records: number; deleted: number; conflicts: number; books: number; positions: number; marks: number; }
export interface ReaderLibrarySyncCandidate { choice: string; label: string; summary: string; deleted: boolean; }
export interface ReaderLibrarySyncConflict { key: string; label: string; candidates: ReaderLibrarySyncCandidate[]; decision?: string; }
export interface ReaderLibrarySyncChannel { id: string; label: string; }
export interface ReaderLibrarySyncSnapshot {
  status: 'idle' | 'loading' | 'review' | 'publishing' | 'pending' | 'completed' | 'failed' | 'unavailable';
  supported: boolean;
  operationId?: string;
  counts?: ReaderLibrarySyncCounts;
  conflicts: ReaderLibrarySyncConflict[];
  joinRequired: boolean;
  reviewRevision: number;
  canRebase: boolean;
  canContinueCommit: boolean;
  restartRequired?: boolean;
  transport?: 'casV1' | 'immutableLogV2';
  channels?: ReaderLibrarySyncChannel[];
  selectedChannel?: string;
  canCleanup?: boolean;
  message: string;
}
