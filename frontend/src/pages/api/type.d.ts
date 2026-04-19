export interface MonitorRoom {
  room_id: string;
  title: string;
  anchor_name: string;
  status: string;
  heat: number;
  platform: string;
  target_type?: string;
}

export interface RankList {
  heat: number;
  room_id: string;
  status: string;
  target_type: string;
  title?: string;
  anchor_name?: string;
}

export interface DashboardInfo {
  live_count: number;
  video_count: number;
  total_heat: number;
}

export interface SentimentDataStruct {
  ts: number;
  value: number;
  count: number;
}

export interface WordCloudItem {
  name: string;
  value: number;
}

export interface HistoryDataPoint {
  time: string;
  value: number;
}

export interface AdminUserItem {
  id: number;
  username: string;
  nickname: string;
  role: string;
  status: string;
  created_at: string;
  is_active?: boolean;
}

export interface AdminRoomItem {
  id: string;
  room_id: string;
  title: string;
  anchor_name: string;
  platform: string;
  status: string;
  heat: number;
  created_at: string;
  target_type?: string;
}
