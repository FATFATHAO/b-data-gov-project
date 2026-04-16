// ============ Catalog ============
export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableInfo {
  name: string;
  layer: string;
  row_count: number;
}

export interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
  row_count: number;
}

// ============ Quality ============
export interface QualityMetrics {
  total_records: number;
  dirty_records: number;
  clean_records: number;
  field_missing_rate: number;
  dirty_rate: number;
}

export interface DailyTrendItem {
  date: string;
  dirty_count: number;
  clean_count: number;
}

export interface DailyTrend {
  items: DailyTrendItem[];
}

// ============ Crawl Health ============
export interface CrawlHealth {
  run_id: string;
  run_time: string;    // ISO datetime string
  up_name: string;
  videos_fetched: number;
  comments_fetched: number;
  dirty_filtered: number;
  spam_truncated: number;
  api_success_rate: number;  // 0.0 ~ 1.0
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'UNKNOWN';
}

// ============ Lineage ============
export interface LineageNode {
  id: string;
  name: string;
  layer: string;
  description: string;
}

export interface LineageEdge {
  source: string;
  target: string;
  label: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

// ============ ROI ============
export interface StorageStats {
  ods_size_mb: number;
  dwd_size_mb: number;
  dws_size_mb: number;
  total_size_mb: number;
  compression_ratio: number;
}

// ============ Tasks / Ingestion ============
export interface TaskItem {
  task_id: string;
  target_type: 'video' | 'up';
  target_id: string;
  fetch_limit: number;
  up_name: string;
  status: 'running' | 'success' | 'failed';
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  tasks: TaskItem[];
  total: number;
}

export interface TaskCreateRequest {
  target_type: 'video' | 'up';
  target_id: string;
  fetch_limit: number;
}
