export interface DashboardInfo {
  live_count: number;
  video_count: number;
  total_heat: number;
}

export interface RankList {
  heat: number;
  room_id: string;
  status: string;
  target_type: string;
  title?: string;
  anchor_name?: string;
}
