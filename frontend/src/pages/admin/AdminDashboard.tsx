import React, { useEffect, useState } from 'react';
import { Table, Tabs, Tag, Button, message, Card, Popconfirm, Tooltip } from 'antd';
import { ReloadOutlined, StopOutlined, SyncOutlined, PauseCircleOutlined, CheckCircleOutlined, UnlockOutlined } from '@ant-design/icons';
import { getAdminUsers, getAdminRooms, deleteAdminRoom, updateUserStatus } from '../api';
import type { AdminUserItem, AdminRoomItem } from '../api/type.d.ts';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [rooms, setRooms] = useState<AdminRoomItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载数据
  const fetchData = async () => {
    setLoading(true);
    try {
      // 使用 Promise.all 并行请求，提高加载速度
      const [userRes, roomRes] = await Promise.all([
        getAdminUsers(),
        getAdminRooms()
      ]);

      setUsers(userRes.data);
      setRooms(roomRes.data);
      message.success('数据已更新');
    } catch (e) {
      console.error(e);
      // 错误通常由拦截器处理，这里可以留空或者打印
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 管理员操作：强制停止任务 ---
  const handleStopRoom = async (roomId: string) => {
    try {
      await deleteAdminRoom(roomId);
      message.success(`房间 ${roomId} 的监控任务已强制停止`);
      // 操作成功后刷新列表
      fetchData();
    } catch (e) {
      // 错误处理
    }
  };

  // 处理用户封禁/解封逻辑
  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    // 目标状态取反：如果是 true(正常)，目标就是 false(封禁)
    const targetStatus = !currentStatus;
    const actionText = targetStatus ? '解封' : '封禁';

    try {
      await updateUserStatus(userId, targetStatus);
      message.success(`用户 ${actionText} 成功`);

      // ⚡️ 乐观更新：直接修改本地 state，不重新请求网络，体验更丝滑
      setUsers(prevUsers =>
        prevUsers.map(u => u.id === userId ? { ...u, is_active: targetStatus } : u)
      );
    } catch (e) {
      console.error(e);
      message.error(`${actionText}失败`);
    }
  };

  // --- 用户表格列定义 ---
  const userColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      )
    },
    {
      title: '账号状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        isActive
          ? <Tag color="success">正常</Tag>
          : <Tag color="error">已封禁</Tag>
      )
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AdminUserItem) => {
        // 判断当前是封禁还是解封
        // record.is_active 为 true 表示正常，false 表示已封禁
        const isActive = Boolean(record.is_active);
        const isBanned = !isActive;
        console.log(record);

        const btnText = isBanned ? '解封账号' : '封禁账号';
        const confirmText = isBanned
          ? `确定要恢复用户 ${record.username} 的权限吗？`
          : `确定要封禁用户 ${record.username} 吗？封禁后该用户将无法登录。`;

        // 管理员不能操作自己或其他管理员 (后端也有校验)
        const isAdmin = record.role === 'admin';

        return (
          <Popconfirm
            title={`${isBanned ? '解封' : '封禁'}操作`}
            description={confirmText}
            onConfirm={() => handleToggleStatus(record.id, isActive)}
            okText="确定"
            cancelText="取消"
            disabled={isAdmin}
          >
            <Button
              type={isBanned ? 'primary' : 'primary'}
              // 如果是封禁操作(danger=true)，如果是解封操作(danger=false)
              danger={!isBanned}
              size="small"
              disabled={isAdmin}
              icon={isBanned ? <UnlockOutlined /> : <StopOutlined />}
              style={isBanned ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}} // 解封按钮给绿色
            >
              {btnText}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  // --- 房间表格列定义 ---
  const roomColumns = [
    { title: '房间号', dataIndex: 'room_id', key: 'room_id' },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (pt: string) => {
        const color = pt === 'bilibili' ? 'pink' : pt === 'douyin' ? 'black' : 'orange';
        return <Tag color={color}>{pt.toUpperCase()}</Tag>;
      }
    },
    {
      title: '类型',
      dataIndex: 'target_type',
      key: 'target_type',
      render: (type: string) => (
        <Tag color={type === 'live' ? 'blue' : 'purple'}>
          {type === 'live' ? '直播' : '视频'}
        </Tag>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AdminRoomItem) => {
        const { status, target_type } = record;

        // 直播状态逻辑
        if (target_type === 'live') {
          if (status === 'RUNNING') {
            return <Tag icon={<SyncOutlined spin />} color="processing">🟢 实时监控中</Tag>;
          } else {
            return <Tag icon={<PauseCircleOutlined />} color="default">⚫ 已停止</Tag>;
          }
        }
        // 视频状态逻辑
        else {
          if (status === 'RUNNING') {
            return <Tag icon={<SyncOutlined spin />} color="geekblue">🔵 正在解析</Tag>;
          } else if (status === 'FINISHED') {
            return <Tag icon={<CheckCircleOutlined />} color="success">✅ 解析完毕</Tag>;
          } else {
            return <Tag color="default">未开始</Tag>;
          }
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AdminRoomItem) => {
        const isRunning = record.status === 'RUNNING';

        return (
          <Popconfirm
            title="强制停止任务"
            description={`确定要终止 ${record.room_id} 的任务吗？`}
            onConfirm={() => handleStopRoom(record.room_id)}
            okText="确定"
            cancelText="取消"
            disabled={!isRunning} // 只有运行中才能停止
          >
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              disabled={!isRunning}
            >
              {record.target_type === 'live' ? '停止监控' : '终止解析'}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#fff', margin: 0 }}>🛡️ 系统超级管理后台</h2>
        <Tooltip title="刷新数据">
          <Button
            shape="circle"
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          />
        </Tooltip>
      </div>

      <Card
        style={{ background: '#141414', border: '1px solid #333' }}
        bodyStyle={{ padding: '0 24px 24px' }} // 调整内部间距
      >
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: '用户管理',
              children: (
                <Table
                  dataSource={users}
                  columns={userColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 8 }}
                />
              )
            },
            {
              key: '2',
              label: '房间全景监控',
              children: (
                <Table
                  dataSource={rooms}
                  columns={roomColumns}
                  rowKey={(record) => `${record.platform}-${record.room_id}`} // 联合主键防止重复
                  loading={loading}
                  pagination={{ pageSize: 8 }}
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;
