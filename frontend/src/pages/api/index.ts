import request from '@/api/request';
import type {
  RankList,
  DashboardInfo,
  SentimentDataStruct,
  WordCloudItem,
  HistoryDataPoint,
  MonitorRoom,
  AdminUserItem,
  AdminRoomItem,
} from './type.d';

// Dashboard
export const getDashboardStats = async (): Promise<{ data: DashboardInfo }> => {
  return request.get('/api/live/dashboard/stats');
};

// 排行榜
export const getRank = async (platform?: string): Promise<{ data: RankList[] }> => {
  return request.get(`/api/live/rank/${platform || 'bilibili'}`);
};

// 历史趋势
export const getHistory = async (roomId: string): Promise<{ data: HistoryDataPoint[] }> => {
  return request.get(`/api/live/monitor/history/${encodeURIComponent(roomId)}`);
};

// 词云
export const getWordCloud = async (roomId: string): Promise<{ data: WordCloudItem[] }> => {
  return request.get(`/api/live/monitor/wordcloud/${encodeURIComponent(roomId)}`);
};

// 情感趋势
export const getSentiment = async (roomId: string): Promise<{ data: SentimentDataStruct[] }> => {
  return request.get(`/api/live/monitor/sentiment/${encodeURIComponent(roomId)}`);
};

// 收藏
export const checkFavorite = async (
  roomId: string,
  platform?: string,
  targetType?: string,
): Promise<{ data: { is_favorited: boolean } }> => {
  return request.get('/api/live/favorites/check', {
    params: { room_id: roomId, platform: platform || 'bilibili', target_type: targetType || 'live' },
  });
};

export const toggleFavorite = async (params: {
  room_id: string;
  platform: string;
  target_type: string;
}): Promise<{ data: { is_favorited: boolean; msg?: string } }> => {
  return request.post('/api/live/favorites/toggle', params);
};

export const getMyFavorites = async (): Promise<{ data: MonitorRoom[] }> => {
  return request.get('/api/live/favorites');
};

// 监控启动/停止
export const startLiveTask = async (
  roomId: string,
  platform: string,
): Promise<{ data: { msg: string } }> => {
  return request.post('/api/live/monitor/start', {
    room_id: roomId,
    platform: platform,
    type: 'live',
  });
};

export const startVideoTask = async (
  roomId: string,
  platform: string,
): Promise<{ data: { msg: string } }> => {
  return request.post('/api/live/monitor/start', {
    room_id: roomId,
    platform: platform,
    type: 'video',
  });
};

export const stopLiveMonitor = async (params: {
  room_id: string;
  platform: string;
}): Promise<{ data: null }> => {
  return request.post('/api/live/monitor/stop', params);
};

export const deleteRoom = async (params: {
  room_id: string;
  platform: string;
}): Promise<{ data: { msg?: string } }> => {
  return request.post('/api/live/monitor/delete', params);
};

// 流地址（客户端生成，不请求后端）
export const getSurgeStreamUrl = (_roomId: string, _platform?: string): string => {
  return '';
};

// Admin（暂不实现）
export const getAdminUsers = async (): Promise<{ data: AdminUserItem[] }> => {
  return { data: [] } as any;
};

export const getAdminRooms = async (): Promise<{ data: AdminRoomItem[] }> => {
  return { data: [] } as any;
};

export const deleteAdminRoom = async (_roomId: string) => {
  return { success: false };
};

export const updateUserStatus = async (_userId: number | string, _status: string | boolean) => {
  return { success: false };
};
