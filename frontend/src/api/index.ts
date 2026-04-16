import request from './request';
import type {
  TableInfo,
  TableSchema,
  QualityMetrics,
  DailyTrend,
  LineageGraph,
  StorageStats,
  CrawlHealth,
  TaskListResponse,
  TaskCreateRequest,
} from './types';

// ============ Catalog ============
export const fetchTables = (): Promise<TableInfo[]> =>
  request.get<TableInfo[]>('/api/catalog/tables') as unknown as Promise<TableInfo[]>;

export const fetchTableSchema = (tableName: string): Promise<TableSchema> =>
  request.get<TableSchema>(`/api/catalog/schema/${tableName}`) as unknown as Promise<TableSchema>;

// ============ Quality ============
export const fetchQualityMetrics = (): Promise<QualityMetrics> =>
  request.get<QualityMetrics>('/api/quality/metrics') as unknown as Promise<QualityMetrics>;

export const fetchDailyTrend = (): Promise<DailyTrend> =>
  request.get<DailyTrend>('/api/quality/daily-trend') as unknown as Promise<DailyTrend>;

export const fetchCrawlHealth = (): Promise<CrawlHealth> =>
  request.get<CrawlHealth>('/api/quality/crawl-health') as unknown as Promise<CrawlHealth>;

// ============ Lineage ============
export const fetchLineageGraph = (): Promise<LineageGraph> =>
  request.get<LineageGraph>('/api/lineage/graph') as unknown as Promise<LineageGraph>;

// ============ ROI ============
export const fetchStorageStats = (): Promise<StorageStats> =>
  request.get<StorageStats>('/api/roi/storage') as unknown as Promise<StorageStats>;

// ============ Tasks / Ingestion ============
export const createTask = (
  body: TaskCreateRequest,
): Promise<{ task_id: string; message: string }> =>
  request.post<{ task_id: string; message: string }>('/api/tasks', body) as unknown as Promise<{ task_id: string; message: string }>;

export const fetchTasks = (): Promise<TaskListResponse> =>
  request.get<TaskListResponse>('/api/tasks') as unknown as Promise<TaskListResponse>;
