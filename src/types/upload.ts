export type UploadStatus =
  | 'pending_mapping'
  | 'parsing'
  | 'completed'
  | 'failed'
  | 'deleted';

export type ItemsMode = 'packed' | 'line-per-row';

export interface ColumnMapping {
  receiptId?: string;
  date?: string;
  time?: string;
  items?: string;
  total?: string;
  tip?: string;
  discount?: string;
  paymentMethod?: string;
  status?: string;
  quantity?: string;
}

export interface UploadStats {
  imported: number;
  skipped: number;
  errors: number;
  totalRows: number;
}

export interface UploadDateRange {
  firstDate?: string;
  lastDate?: string;
}

export interface Upload {
  _id: string;
  cafeId: string;
  uploadedBy: { _id: string; name: string; email: string } | string;
  fileName: string;
  fileSize: number;
  r2Key: string;
  posType: 'yoco' | 'wizard';
  columnMapping: ColumnMapping;
  itemsMode: ItemsMode;
  status: UploadStatus;
  stats: UploadStats;
  dateRange: UploadDateRange;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StageUploadResponse {
  success: true;
  uploadId: string;
  posType: 'yoco' | 'wizard';
  columnMapping: ColumnMapping;
  itemsMode: ItemsMode;
  headers: string[];
  preview: Record<string, string>[];
  needsConfirmation: boolean;
}
