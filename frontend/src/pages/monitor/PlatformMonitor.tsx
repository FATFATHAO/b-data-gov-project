import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, List, Badge, Typography, Tag, Space, Empty, message, Button, Row, Col } from 'antd';
import Icon, { BilibiliOutlined, CheckCircleOutlined, CloseCircleOutlined, FireOutlined, MinusCircleOutlined, PlayCircleOutlined, PoweroffOutlined, StarFilled, StarOutlined, SyncOutlined, TikTokOutlined } from '@ant-design/icons';
import MonitorChart from '@/components/charts/MonitorChart';
import TaskControl from '@/components/charts/TaskControl';
import { getRank, getHistory, getWordCloud, getSentiment, checkFavorite, toggleFavorite, stopLiveMonitor, startLiveTask } from '../api';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import WordCloudChart from '@/components/charts/WordCloudChart';
import HotWordsRank from '@/components/charts/HotWordsRank';
import SentimentChart from '@/components/charts/SentimentChart';
import type { SentimentDataStruct } from '@/components/charts/type';
import type { RankList } from './type';
import SurgeDanmakuList from '@/components/charts/SurgeDanmakuList';

const { Sider, Content } = Layout;
const { Text } = Typography;

interface Props {
  platformName: string;
  enableVideo?: boolean;
}

const DouyuSvg: React.FC = () => (
  <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7447" width="20" height="20"><path d="M492.183 120.816c-8.655 4.515-11.29 13.548-2.634 10.537 11.29-4.139 52.309-4.515 56.073-0.754 3.010 3.010 1.882 4.139-4.892 4.139-16.934 0-70.748 21.451-99.724 39.514-58.329 36.127-132.088 106.123-170.097 160.688-18.063 25.966-20.321 39.89-8.655 57.578 12.043 18.817 49.298 46.664 76.016 57.578 13.923 5.644 25.59 11.29 25.59 12.419 0 1.505-7.903 5.269-17.688 9.032-10.16 3.763-28.224 13.172-40.643 21.074l-22.956 14.3-50.428-3.386c-65.479-4.515-132.464-4.515-143.754-0.376-8.28 3.010-11.29 14.676-45.911 173.107-20.321 93.704-35.752 172.731-34.622 175.741 1.505 4.515 17.688 5.269 98.973 5.269 114.401 0 131.711-3.010 157.302-27.848l15.805-15.429 5.644 11.29c17.688 35.752 101.23 43.276 147.14 12.795 9.032-5.644 18.439-15.052 21.451-20.321l4.892-9.408 8.28 13.923c4.515 8.655 14.676 18.063 24.462 23.709 15.052 8.279 21.451 9.408 54.943 9.408 34.622 0 39.514-1.129 59.834-11.29 31.235-16.181 40.267-31.986 53.061-95.209 5.644-27.471 11.665-48.543 12.795-47.039 1.505 1.882 4.515 18.439 6.774 37.256 4.139 30.481 3.763 37.632-3.010 68.867-6.020 26.719-6.774 36.127-3.386 40.267 6.020 7.527 79.781 7.527 85.8 0 2.259-3.010 7.903-21.827 12.043-42.148 6.398-29.73 12.419-45.159 29.353-75.64 11.665-21.451 22.204-38.761 23.333-38.761 1.129 0-3.010 24.838-9.408 54.943-10.537 50.804-10.914 55.695-5.644 70.371 9.785 28.6 41.771 42.524 91.821 39.138 44.405-2.634 69.619-17.311 82.414-47.792 4.515-10.914 39.89-181.386 39.89-192.299 0-1.882-17.688-3.386-39.514-3.386-45.911 0-46.664-0.754-38.009-30.481 7.15-24.084 3.386-42.524-12.043-57.201-12.043-11.665-31.986-18.439-44.029-15.429-15.429 3.763-17.311-5.644-7.527-36.88 12.419-39.514 16.934-69.242 16.934-117.787 0-31.986 1.882-44.782 7.15-56.824 9.408-21.073 28.6-41.771 47.039-51.18 8.655-4.139 16.558-9.408 17.688-11.29 4.515-7.15-1.505-18.063-19.193-34.622-44.029-41.396-109.886-57.953-188.912-47.792l-34.997 4.892-35.752-12.419c-30.106-10.16-42.9-12.043-80.909-13.548-31.235-1.129-51.18-4.139-65.104-9.032-22.956-8.279-40.267-9.032-53.061-2.259zM664.536 164.468c18.817 6.398 46.288 17.688 61.339 25.59 35.752 18.439 36.127 18.817 28.224 9.785-6.774-7.527-6.398-7.903 3.010-15.429 41.396-32.74 159.936-10.914 190.042 34.997l7.15 10.537-28.977 11.665c-31.61 12.795-48.169 22.956-68.492 42.524l-13.548 12.419-13.923-18.817c-7.903-10.537-15.805-18.817-17.688-18.817-5.644 0-4.892 1.129 9.032 21.827 16.181 24.462 35.374 70.371 40.267 97.467 11.29 60.211-14.676 133.593-69.619 197.192l-27.848 32.363-48.543 2.259c-26.342 1.505-57.953 2.634-70.371 2.634-21.074 0-21.827-0.376-19.567-8.655 1.505-4.515 3.763-14.676 4.892-22.204 1.882-12.795 4.515-15.429 25.59-27.471 39.514-21.827 65.104-58.329 56.448-79.781-1.882-5.269-3.386-3.763-7.527 7.527-7.905 22.956-21.073 39.514-42.9 54.19-35.375 23.709-53.437 28.977-100.102 28.977-37.632 0.376-43.276-0.754-60.211-9.408-10.537-5.269-18.817-12.043-18.817-14.676 0-3.763 14.3-10.537 40.643-19.193 54.567-18.439 93.704-45.534 82.038-57.201-2.634-2.634-6.774 0-13.548 8.279-6.020 6.774-13.548 11.665-18.817 11.665-8.655 0-39.514-20.697-42.148-28.224-0.754-2.259 9.785-3.763 26.342-4.139 15.052-0.376 31.235-2.634 35.752-4.892 11.29-6.020 21.827-27.471 27.471-56.448 3.386-18.439 6.774-25.213 15.052-31.61 14.3-10.537 13.548-13.923-2.634-13.923-18.817 0-27.471-5.644-35.752-23.709-7.903-17.688-7.903-17.311-7.15 15.429 0.376 18.063-1.129 26.342-7.527 36.502-9.785 15.805-39.514 41.395-67.738 58.706l-20.697 12.795h-62.093c-61.717 0-62.093 0-86.554-11.665-41.771-19.567-72.63-53.061-64.351-68.867 5.269-9.408 45.534-60.588 66.984-84.672 17.311-19.193 85.426-77.522 99.348-85.426 7.527-3.763 7.903-3.386 5.269 2.634-10.16 23.709-1.882 49.675 20.321 64.351 26.342 17.688 59.082 14.676 81.661-7.903 30.106-30.106 21.074-70.748-18.817-89.188l-15.052-6.398 15.052-2.634c7.903-1.505 16.558-3.010 18.439-4.139 2.259-0.754 20.321-0.754 40.267 0.376 27.471 1.129 45.159 4.515 70.371 12.795zM541.104 176.51c32.74 23.333 27.471 66.233-9.785 82.79-27.848 12.419-57.953 2.634-68.114-21.827-11.29-26.342-4.515-44.782 20.697-59.082 21.451-12.043 42.148-12.795 57.201-1.882zM528.685 464.773c12.419 9.408 26.719 32.74 22.579 36.88-1.129 1.505-10.914 5.644-21.073 9.408-15.052 5.644-18.817 6.020-17.311 2.259 3.010-7.527-16.934-36.127-27.471-40.267-11.665-4.515-10.914-13.172 1.882-17.688 13.172-4.892 25.966-1.882 41.395 9.408zM474.495 471.546c1.129 3.010 1.129 8.28-0.376 11.665-1.129 3.386 3.010 12.419 9.785 22.204 10.914 15.052 11.29 16.558 4.515 18.817-3.763 1.129-9.785 5.269-13.548 9.408-6.398 7.15-6.398 7.903 0.376 15.429 17.688 19.567 64.727 32.363 104.993 28.6 26.719-2.634 31.986 1.129 31.986 21.451v9.785h-119.669l-4.515-10.914c-2.259-6.398-18.063-23.333-34.245-38.009-16.181-15.052-30.857-30.857-31.986-35.752-3.386-14.3 5.269-34.622 20.321-47.039 15.052-12.043 28.6-14.676 32.363-5.644zM415.789 475.308c0.754 0.754-0.376 4.515-2.634 8.655-6.020 10.914-5.269 38.761 1.505 54.567 4.139 10.16 4.515 16.181 1.882 23.709-4.892 12.043-3.763 13.548 22.579 26.719 22.956 12.043 30.481 22.579 12.795 18.439-6.020-1.505-22.579-3.386-37.256-4.515-29.73-2.634-63.598 6.774-79.781 21.827-4.515 4.515-9.408 7.527-10.16 6.398-0.754-0.754 1.129-15.429 4.139-32.363 6.398-38.761 3.010-55.695-15.805-72.253-7.527-6.398-15.052-11.665-17.311-11.665-13.548 0 23.709-23.333 58.329-36.502 17.311-6.398 27.471-8.279 41.771-6.398 10.16 1.129 19.193 2.634 19.944 3.386zM250.207 518.585c49.675 6.398 66.233 20.321 65.479 54.943-0.376 19.944-34.997 187.032-44.782 216.007-7.903 23.333-25.213 40.267-47.792 47.039-27.095 8.279-197.943 8.279-197.943 0.376 0-5.644 62.468-303.691 66.233-315.733 1.882-5.644 8.279-6.398 66.609-6.398 35.752 0 77.145 1.882 92.199 3.763zM918.93 539.284c20.697 20.321 6.020 54.567-22.956 54.567-19.944 0-31.61-11.665-31.61-31.61 0-20.321 11.29-32.363 30.857-32.363 10.537 0 17.311 2.634 23.709 9.408zM443.637 620.945c19.567 5.644 33.115 22.204 33.115 39.89 0 21.451-25.213 131.335-32.74 144.883-8.655 14.3-27.095 27.471-45.911 32.74-21.451 6.020-63.222 4.515-78.275-2.259-27.471-13.172-29.73-29.73-14.3-101.607 14.3-67.362 19.193-81.285 31.61-93.328 22.204-21.073 72.253-30.857 106.499-20.321zM579.113 622.074c0.754 1.129-6.398 39.514-16.181 85.426-10.16 46.288-18.439 87.683-18.439 92.199 0 11.665 13.923 11.665 19.193 0 1.882-4.515 12.043-46.664 21.827-92.951l17.688-84.672 66.233-2.259-2.259 16.181c-6.774 44.782-36.502 167.462-42.9 176.118-3.763 5.269-15.805 13.923-27.095 19.567-16.181 8.655-25.213 10.537-46.288 10.537-50.804 0-72.63-13.548-71.501-44.405 0.376-13.923 19.567-111.767 33.115-169.344 1.882-7.905 4.139-8.279 33.492-8.279 16.934 0 31.986 0.754 33.115 1.882zM743.94 657.825c0 20.697 1.129 37.632 3.010 37.632 1.505 0 10.16-16.934 19.193-37.632l16.558-37.632h29.353c16.558 0 29.73 1.129 29.73 3.010 0 1.505-17.311 33.115-38.761 70.371-33.869 59.082-39.89 71.877-45.534 99.724-3.763 17.688-7.527 34.997-8.28 38.385-1.882 5.644-6.774 6.774-31.986 6.774-16.181 0-29.73-1.505-29.73-3.386s3.386-19.567 7.527-39.514l7.527-36.127-9.408-68.867c-5.269-37.632-9.408-68.867-9.408-69.619 0-0.376 13.548-0.754 30.106-0.754h30.106v37.632zM923.069 626.589c-4.515 16.558-36.127 168.216-36.127 174.613 0 10.537 14.3 9.032 19.193-1.882 2.259-4.892 12.043-46.664 21.827-92.951l17.688-84.296 34.622-1.129c26.719-0.754 34.245 0 32.74 3.763-0.754 2.634-9.408 41.019-18.817 85.426-9.408 44.029-19.567 85.8-22.204 92.575-6.020 13.923-24.462 28.977-43.276 35.375-16.558 5.269-59.458 5.269-76.016 0-29.73-10.16-35.752-23.709-28.224-63.222 5.269-26.342 25.966-126.067 30.481-146.388 1.882-7.905 3.763-8.279 36.127-8.279 30.481 0 33.869 0.754 31.986 6.398z" p-id="7448" fill="#ffffff"></path><path d="M488.418 189.682c-11.665 9.785-15.429 25.59-9.408 40.643 2.259 5.644 3.010 5.644 7.15-0.376 4.139-5.644 5.644-5.644 10.914-1.505 5.644 4.892 5.644 5.644 0 12.043-6.020 6.774-6.020 7.15 2.634 7.905 28.224 1.505 44.782-10.16 44.782-31.61 0-11.29-0.376-11.665-7.15-5.269-15.429 13.923-36.502-5.269-24.838-22.579 5.644-8.655 5.644-9.032-3.386-9.032-4.892 0-14.3 4.515-20.697 9.785zM181.342 575.786c-3.010 9.785-43.276 202.836-43.276 208.105 0 6.774 12.043 7.527 23.333 1.505s15.429-19.567 34.997-115.153c15.052-72.253 17.311-88.435 13.172-92.951-5.644-7.15-25.966-7.903-28.224-1.505zM392.457 658.575c-5.269 8.655-32.363 126.82-32.363 141.873 0 9.408 11.665 10.914 18.439 2.634 7.527-9.032 34.622-142.249 29.73-147.893-5.644-7.15-9.408-6.020-15.805 3.386z" p-id="7449" fill="#ffffff"></path></svg>
)

const DouyuIcon: React.FC<Partial<CustomIconComponentProps>> = (props) => (
  <Icon component={DouyuSvg} {...props} size={4} />
);

const PlatformMonitor: React.FC<Props> = ({ platformName, enableVideo }) => {
  const [rankList, setRankList] = useState<RankList[]>([]);
  // const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { roomId } = useParams();
  const navigate = useNavigate();

  const selectedRoomId = roomId || null;

  const [chartData, setChartData] = useState<any[]>([]);

  // 词云state
  const [wordCloudData, setWordCloudData] = useState<any[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  // 当前房间是否已经拉取过词云
  const fetchedFinishedRef = useRef<Set<String>>(new Set())
  // 记录上次排行榜房间
  const lastKnownStatusRef = useRef<string>("RUNNING");
  // 情感数据
  const [sentimentData, setSentimentData] = useState<SentimentDataStruct[]>([]);

  // 收藏状态
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // 暂停监控
  const [stopLoading, setStopLoading] = useState(false);

  // 标题和作者
  const { displayTitle, displayAnchor } = React.useMemo(() => {
    if (!selectedRoomId) return { displayTitle: '', displayAnchor: '' };

    // 尝试从 rankList 中查找
    // 注意：rankList 中的 room_id 是带前缀的 (bilibili:123)，也可能是不带的 (取决于你的后端返回)
    // 你的后端 RankItem 返回的是 full_id (bilibili:123)，所以我们需要匹配一下
    const currentRoom = rankList.find(r => {
      // 简单粗暴匹配：要么完全相等，要么包含
      // 因为后端返回的 rankList 里的 room_id 可能是 "bilibili:123"
      return r.room_id === selectedRoomId || r.room_id.endsWith(`:${selectedRoomId}`);
    });

    if (currentRoom) {
      return {
        displayTitle: currentRoom.title || selectedRoomId,
        displayAnchor: currentRoom.anchor_name || '未知'
      };
    }

    // 兜底：如果榜单里没找到（可能没上榜），暂时显示 ID
    return {
      displayTitle: selectedRoomId,
      displayAnchor: '加载中...' // 提示用户正在尝试获取或未上榜
    };
  }, [selectedRoomId, rankList]); // 依赖项：ID 和 榜单数据

  // 辅助函数：构造带前缀的API Room ID
  const getApiRoomId = (rawId: string | null, platform: string) => {
    if (!rawId) return '';
    if (rawId.includes(':')) return rawId; // 已经有了

    const pf = platform.toLowerCase();
    if (pf === 'bilibili') {
      return rawId.startsWith('BV') ? `bilibili_video:${rawId}` : `bilibili:${rawId}`;
    }
    return `${pf}:${rawId}`;
  };

  // 计算当前用于请求的 ID (用于传给子组件)
  const activeApiRoomId = React.useMemo(() =>
    getApiRoomId(selectedRoomId, platformName),
    [selectedRoomId, platformName]
  );

  // 获取当前选中房间的状态
  const currentRoomStatus = React.useMemo(() => {
    const room = rankList.find(r => r.room_id === selectedRoomId || r.room_id.endsWith(`:${selectedRoomId}`));
    return room ? room.status : 'UNKNOWN';
  }, [rankList, selectedRoomId]);

  // 处理开始监控逻辑
  const handleStartMonitor = async () => {
    if (!selectedRoomId) return;
    setStopLoading(true); // 复用 loading 状态
    try {
      const rawId = getRawId(selectedRoomId);
      // 调用启动接口
      await startLiveTask(rawId, platformName.toLowerCase());
      message.success("已发送启动信号，任务即将开始");
      // 可以在这里手动刷新一下列表，或者等轮询
    } catch (e) {
      console.error(e);
      message.error("启动失败");
    } finally {
      setStopLoading(false);
    }
  };

  // 处理停止逻辑
  const handleStopMonitor = async () => {
    if (!selectedRoomId) return;
    setStopLoading(true);
    try {
      const rawId = getRawId(selectedRoomId);
      await stopLiveMonitor({
        room_id: rawId,
        platform: platformName.toLowerCase()
      });
      message.success("已发送停止信号，任务即将停止");
      // 这里可以手动刷新一下状态，或者等待轮询自动更新
    } catch (e) {
      console.error(e);
      message.error("停止失败");
    } finally {
      setStopLoading(false);
    }
  };

  // 数据轮询
  // 获取排行榜
  useEffect(() => {
    const fetchRank = async () => {
      try {
        const res = await getRank(platformName.toLowerCase());
        setRankList(res.data);
        // 如果没人选，默认选第一名
        if (!selectedRoomId && res.data.length > 0) {
          const firstRoomId = res.data[0].room_id;
          // 构建跳转路径
          navigate(`/${platformName.toLowerCase()}/${firstRoomId}`, { replace: true })
        }
      } catch (e) { console.error(e); }
    };
    fetchRank();
    const timer = setInterval(fetchRank, 2000);
    return () => clearInterval(timer);
  }, [selectedRoomId, platformName]);

  // 监听房间变化, 检查收藏状态
  useEffect(() => {
    if (selectedRoomId) {
      checkFavStatus();
    } else {
      setIsFavorited(false);
    }
  }, [selectedRoomId]);

  // 清洗ID，提取原始RoomID/BvID
  const getRawId = (id: string | null) => {
    if (!id) return "";
    // 如果包含冒号（说明是Redis格式，如 bilibili_video:BVxxx 或 bilibili:123）
    if (id.includes(':')) {
      return id.split(':').pop() || "";
    }
    return id;
  };

  //  辅助函数：判断类型
  const getTargetType = (id: string | null) => {
    if (!id) return "live";
    // 如果包含 video 关键字 或者 以 BV 开头 (兼容处理)
    if (id.includes("video") || id.startsWith("BV")) {
      return "video";
    }
    return "live";
  }

  // 检查是否已经收藏了当前视频
  const checkFavStatus = async () => {
    if (!selectedRoomId) return;
    try {
      // 判断是视频还是直播
      const rawId = getRawId(selectedRoomId);
      const targetType = getTargetType(selectedRoomId);
      const res = await checkFavorite(rawId, platformName.toLowerCase(), targetType);
      setIsFavorited(res.data.is_favorited);
    } catch (e) {
      console.error("检查收藏状态失败", e);
    }
  }

  // 处理切换收藏逻辑
  const handleToggleFavorite = async () => {
    if (!selectedRoomId) return;
    setFavLoading(true);
    try {
      const rawId = getRawId(selectedRoomId);
      const targetType = getTargetType(selectedRoomId);
      const res = await toggleFavorite({
        room_id: rawId,
        platform: platformName.toLowerCase(),
        target_type: targetType,
      });
      setIsFavorited(res.data.is_favorited);
      message.success(res.data.msg);
    } catch (e) {
      console.error(e);
    } finally {
      setFavLoading(false);
    }
  }


  // 建议将清空逻辑独立出来，只监听 selectedRoomId
  useEffect(() => {
    setChartData([]);
    setWordCloudData([]);
    setSentimentData([]);
    setLoadingCloud(true); // 切换时显示加载
    // 重置 ref 记录
    fetchedFinishedRef.current.delete(selectedRoomId || "");
  }, [selectedRoomId]);

  // 获取图表数据
  useEffect(() => {
    if (!selectedRoomId) return;

    // // 从rankList中找到当前选中任务的状态
    // const currentTask = rankList.find(r => r.room_id === selectedRoomId);
    // console.log(currentTask);
    // 默认状态为RUNNING,防止undefined
    let status = "RUNNING";

    if (rankList.length > 0) {
      const currentTask = rankList.find(r => r.room_id === selectedRoomId);
      if (currentTask) {
        status = currentTask.status;
        lastKnownStatusRef.current = status;
      } else {
        console.warn(`Room ${selectedRoomId} missing from RankList, assuming STOPPED.`);
        status = "STOPPED";
      }
    } else {
      status = lastKnownStatusRef.current;
    }

    // if (currentTask) {
    //   // 如果还在榜单上就使用榜单的状态
    //   status = currentTask.status;
    //   lastKnownStatusRef.current = status;
    // } else {
    //   // 如果当前选中的房间已经不在榜单里，说明我们的任务结束了
    //   // console.warn(`Room ${selectedRoomId} is missing from RankList, assuming STOPPED.`);
    //   status = "STOPPED";
    // }

    console.log(`Room: ${selectedRoomId}, Status: ${status}`);

    // const isVideo = selectedRoomId.startsWith("bilibili_video");

    // 清空旧数据，让图表重新加载
    // setChartData([]);
    // setWordCloudData([]);

    const fetchData = async () => {

      let apiRoomId = activeApiRoomId;
      const platform = platformName.toLowerCase();

      if (!selectedRoomId.includes(":")) {
        if (platform === "bilibili") {
          if (selectedRoomId.startsWith("BV")) {
            apiRoomId = `bilibili_video:${selectedRoomId}`;
          } else {
            apiRoomId = `bilibili:${selectedRoomId}`;
          }
        } else {
          apiRoomId = `${platform}:${selectedRoomId}`;
        }
      }

      try {
        // 历史趋势图：无论视频还是直播，都需要实时拉取（或者视频拉一次也行，这里假设视频热度也变）
        const historyRes = await getHistory(apiRoomId);
        if (historyRes.data && historyRes.data) {
          setChartData(historyRes.data);
        }

        // 获取情感数据
        try {
          const sentRes = await getSentiment(apiRoomId);
          if (sentRes.data && sentRes.data) {
            setSentimentData(sentRes.data);
          }
        } catch (err) {
          console.error(err);
        }

        // 词云逻辑控制
        // 如果是直播 -> 每次都拉取
        // 如果是视频 -> 并且之前没有拉取过这个BV号 -> 拉取
        let shouldFetchCloud = false;
        if (status === 'RUNNING') {
          shouldFetchCloud = true;
          // 如果之前被误标记为已拉取(比如从暂停恢复到运行),移除标记
          if (fetchedFinishedRef.current.has(selectedRoomId)) {
            fetchedFinishedRef.current.delete(selectedRoomId)
          }
        }
        // 如果状态是FINISHED或STOPPED -> 只拉取一次
        else if (status === 'FINISHED' || status === 'STOPPED') {
          if (!fetchedFinishedRef.current.has(selectedRoomId)) {
            shouldFetchCloud = true;
          }
        }
        // FAILED -> 不拉取

        if (shouldFetchCloud) {
          // 只有第一次拉取时显示 loading，避免轮询闪烁
          if (wordCloudData.length === 0) setLoadingCloud(true);

          const cloudRes = await getWordCloud(apiRoomId);
          setLoadingCloud(false);

          if (cloudRes.data) {
            const newData = Array.isArray(cloudRes.data) ? cloudRes.data : [];
            setWordCloudData(newData);

            // 如果是非 Running 状态，标记为已拉取，下次轮询不再请求
            if (status !== 'RUNNING') {
              fetchedFinishedRef.current.add(selectedRoomId);
            }
          }
        }
      } catch (e) {
        console.error(e);
        setLoadingCloud(false);
      }
    };

    fetchData();

    const timer = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(timer);
  }, [selectedRoomId, rankList]);

  // 状态图标映射
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'FINISHED': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'STOPPED': return <MinusCircleOutlined style={{ color: '#faad14' }} />;
      case 'FAILED': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <SyncOutlined spin />;
    }
  };

  const platformIcon: { [key: string]: any } = {
    ["Bilibili"]: <BilibiliOutlined />,
    ["Douyin"]: <TikTokOutlined />,
    ["Douyu"]: <DouyuIcon />
  };

  return (
    <Layout style={{ height: 'calc(100vh - 64px)' }}> {/* 减去 Header 高度，铺满剩余屏幕 */}

      {/* --- 左侧：资源列表 (作为 Sider 存在于页面内部) --- */}
      <Sider
        width={350}
        style={{
          background: '#0a0a0a',
          borderRight: '1px solid #333',
          overflowY: 'auto',
          height: '100%'
        }}
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ color: '#fff', fontSize: '16px' }}>
              {platformIcon[platformName]} {platformName} 监控目标
            </Text>
            <Tag color="blue">{rankList.length} Active</Tag>
          </div>

          {rankList.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#666' }}>暂无任务</span>} />
          ) : (
            <List
              dataSource={rankList}
              renderItem={(item, index) => {
                const isVideo = item.target_type === 'video';
                const isSelected = selectedRoomId === item.room_id;

                const displayName = item.title || item.room_id;

                return (
                  <div
                    onClick={() => navigate(`/${platformName.toLowerCase()}/${item.room_id}`)}
                    style={{
                      padding: '12px 16px',
                      marginBottom: 8,
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'linear-gradient(90deg, #10239e 0%, #000 100%)' : 'rgba(255,255,255,0.03)',
                      borderLeft: isSelected ? '4px solid #1890ff' : '4px solid transparent',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Space>
                        <Badge
                          count={index + 1}
                          style={{ backgroundColor: index < 3 ? '#ff4d4f' : '#2db7f5', boxShadow: 'none' }}
                        />
                        <Text style={{ color: isSelected ? '#fff' : '#ccc', fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {displayName}
                        </Text>
                        <Text style={{ color: '#666', fontSize: 10 }}>
                          {item.anchor_name || '未知'}
                        </Text>
                      </Space>
                      {isVideo ? <Tag color="gold">视频</Tag> : <Tag color="cyan">直播</Tag>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                      <span>Status: {getStatusIcon(item.status)}</span>
                      <span style={{ color: '#faad14' }}>
                        <FireOutlined /> {item.heat}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </Sider>

      {/* --- 右侧：内容大屏 --- */}
      <Content style={{ background: '#000', padding: '24px', overflowY: 'auto' }}>

        {selectedRoomId && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            background: '#141414',
            padding: '16px 24px',
            borderRadius: 8,
            border: '1px solid #333'
          }}>
            <Space>
              <Space>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                  当前监控: <span style={{ color: '#1890ff' }}>{displayTitle}</span>
                </div>
              </Space>
              {selectedRoomId.startsWith('BV') ? <Tag color="gold">视频</Tag> : <Tag color="cyan">直播</Tag>}
              <div style={{ color: '#666', fontSize: 12 }}>
                ID: <span style={{ fontFamily: 'monospace' }}>{selectedRoomId}</span>
                <span style={{ margin: '0 8px' }}>|</span>
                UP主: {displayAnchor}
              </div>
            </Space>
            <Space>
              <Button
                type={isFavorited ? "primary" : "default"}
                icon={isFavorited ? <StarFilled /> : <StarOutlined />}
                loading={favLoading}
                onClick={handleToggleFavorite}
                style={{
                  backgroundColor: isFavorited ? '#faad14' : 'transparent',
                  borderColor: isFavorited ? '#faad14' : '#555',
                  color: isFavorited ? '#000' : '#ccc'
                }}
              >
                {isFavorited ? "已收藏" : "收藏"}
              </Button>

              {currentRoomStatus === 'RUNNING' ? (
                <Button
                  danger
                  type="primary"
                  icon={<PoweroffOutlined />}
                  loading={stopLoading}
                  onClick={handleStopMonitor}
                >
                  停止监控
                </Button>
              ) : (
                <Button
                  type="primary"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} // 绿色
                  icon={<PlayCircleOutlined />}
                  loading={stopLoading}
                  onClick={handleStartMonitor}
                >
                  启动监控
                </Button>
              )}
            </Space>
          </div>
        )}

        {/* 任务控制台 (放在最上面，随时添加新任务) */}
        <TaskControl platformName={platformName} enableVideo={enableVideo} />

        {/* 核心监控图表 */}
        <MonitorChart roomId={selectedRoomId} data={chartData} />

        {/* 情感趋势图 */}
        <Row gutter={24}>
          <Col span={16}>
            <SentimentChart
              key={selectedRoomId + "SentimentChart"}
              roomId={selectedRoomId}
              data={sentimentData}
              loading={sentimentData.length === 0 && loadingCloud}
              style={{ height: 400 }}
            />
          </Col>
          <Col span={8}>
            <SurgeDanmakuList
              roomId={activeApiRoomId}
              style={{ height: 400 }}
              sentimentData={sentimentData}
            />
          </Col>
        </Row>

        {/* 这里还可以加更多模块，比如 "最新弹幕滚动列表" */}
        {/* 词云图 */}
        <WordCloudChart
          key={selectedRoomId + "WordCloudChart"}
          roomId={selectedRoomId}
          data={wordCloudData}
          loading={loadingCloud && wordCloudData.length === 0}
        />

        {/* 热词排行榜 */}
        <HotWordsRank
          key={selectedRoomId + "HotWordsRank"}
          roomId={selectedRoomId}
          data={wordCloudData}
          loading={loadingCloud && wordCloudData.length === 0}
          platformName={platformName.toLowerCase()}
        />
      </Content>
    </Layout>
  );
};

export default PlatformMonitor;

