import type { RankList, DashboardInfo, SentimentDataStruct, WordCloudItem, HistoryDataPoint, MonitorRoom, AdminUserItem, AdminRoomItem } from './type.d';

export const getDashboardStats = async (): Promise<{ data: DashboardInfo }> => {
  return {
    data: {
      live_count: 0,
      video_count: 0,
      total_heat: 0,
    },
  };
};

export const getMyFavorites = async (): Promise<{ data: MonitorRoom[] }> => {
  return { data: [] };
};

export const getRank = async (_platform?: string): Promise<{ data: RankList[] }> => {
  return { data: [] };
};

export const getHistory = async (_roomId: string): Promise<{ data: HistoryDataPoint[] }> => {
  return { data: [] };
};

export const getWordCloud = async (_roomId: string): Promise<{ data: WordCloudItem[] }> => {
  return { data: [] };
};

export const getSentiment = async (_roomId: string): Promise<{ data: SentimentDataStruct[] }> => {
  return { data: [] };
};

export const checkFavorite = async (_roomId: string, _platform?: string, _targetType?: string): Promise<{ data: { is_favorited: boolean } }> => {
  return { data: { is_favorited: false } };
};

export const toggleFavorite = async (_params: { room_id: string; platform: string; target_type: string }): Promise<{ data: { is_favorited: boolean; msg?: string } }> => {
  return { data: { is_favorited: false, msg: 'ok' } };
};

export const stopLiveMonitor = async (_params: { room_id: string; platform: string }): Promise<{ data: null }> => {
  return { data: null };
};

export const startLiveTask = async (_roomId: string, _platform: string): Promise<{ data: { msg: string } }> => {
  return { data: { msg: 'ok' } };
};

export const startVideoTask = async (_roomId: string, _platform: string): Promise<{ data: { msg: string } }> => {
  return { data: { msg: 'ok' } };
};

export const getSurgeStreamUrl = (_roomId: string, _platform?: string): string => {
  return '';
};

export const getAdminUsers = async (): Promise<{ data: AdminUserItem[] }> => {
  return { data: [] };
};

export const getAdminRooms = async (): Promise<{ data: AdminRoomItem[] }> => {
  return { data: [] };
};

export const deleteAdminRoom = async (_roomId: string) => {
  return { success: false };
};

export const updateUserStatus = async (_userId: number | string, _status: string | boolean) => {
  return { success: false };
};
