import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Spin,
  Divider,
  Row,
  Col,
  Statistic,
  message,
  theme,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  VideoCameraAddOutlined,
  UserSwitchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { createTask, fetchTasks } from '../../api';
import type { TaskCreateRequest, TaskItem } from '../../api';

const { Text } = Typography;

interface TaskCreateFormValues {
  target_type: 'video' | 'up';
  target_id: string;
  fetch_limit: number;
}

const TARGET_TYPE_OPTIONS = [
  { value: 'video', label: '视频评论', icon: <VideoCameraAddOutlined /> },
  { value: 'up', label: 'UP主视频', icon: <UserSwitchOutlined /> },
];

const POLL_INTERVAL_MS = 3000;

const Ingestion = () => {
  const [form] = Form.useForm<TaskCreateFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [polling, setPolling] = useState(false);
  const { token } = theme.useToken();

  const loadTasks = useCallback(async () => {
    try {
      const resp = await fetchTasks();
      setTasks(resp.tasks);
      // 如果有 running 任务，启动轮询
      const hasRunning = resp.tasks.some((t) => t.status === 'running');
      setPolling(hasRunning);
    } catch {
      // 静默失败
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      loadTasks();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [polling, loadTasks]);

  const handleSubmit = async (values: TaskCreateFormValues) => {
    setSubmitting(true);
    try {
      const resp = await createTask(values as TaskCreateRequest);
      message.success(resp.message);
      await loadTasks();
    } catch (e: unknown) {
      message.error(`提交失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    running: { color: 'processing', icon: <ClockCircleOutlined />, label: '运行中' },
    success: { color: 'success', icon: <CheckCircleOutlined />, label: '成功' },
    failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
  };

  const renderStatusTag = (status: string) => {
    const cfg = statusConfig[status] ?? { color: 'default', icon: null, label: status };
    return (
      <Tag color={cfg.color} icon={cfg.icon}>
        {cfg.label}
      </Tag>
    );
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 120,
      render: (id: string) => <Text code style={{ fontSize: 12 }}>{id}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (type: string) => {
        const opt = TARGET_TYPE_OPTIONS.find((o) => o.value === type);
        return opt ? (
          <Space>
            {opt.icon}
            {opt.label}
          </Space>
        ) : type;
      },
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 140,
      render: (id: string) => <Text copyable={{ text: id }}>{id}</Text>,
    },
    {
      title: '采集条数',
      dataIndex: 'fetch_limit',
      key: 'fetch_limit',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'UP主',
      dataIndex: 'up_name',
      key: 'up_name',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatusTag,
    },
    {
      title: '错误信息',
      dataIndex: 'error_msg',
      key: 'error_msg',
      ellipsis: true,
      render: (msg: string | null) =>
        msg ? <Text type="danger">{msg}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (ts: string) => new Date(ts).toLocaleString('zh-CN'),
    },
  ];

  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const successCount = tasks.filter((t) => t.status === 'success').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;

  return (
    <div>
      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="运行中"
              value={runningCount}
              valueStyle={{ color: token.colorInfo }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="成功"
              value={successCount}
              valueStyle={{ color: token.colorSuccess }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="失败"
              value={failedCount}
              valueStyle={{ color: token.colorError }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="历史任务"
              value={tasks.length}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
      </Row>

      {/* 采集配置表单 */}
      <Card
        title="新建采集任务"
        size="small"
        style={{ marginBottom: 24 }}
        extra={
          <Tag icon={<ClockCircleOutlined />}>
            {polling ? (
              <>
                轮询中 <Spin size="small" />
              </>
            ) : (
              '等待提交'
            )}
          </Tag>
        }
      >
        <Form
          form={form}
          layout="inline"
          onFinish={handleSubmit}
          initialValues={{ target_type: 'up', target_id: '', fetch_limit: 100 }}
        >
          <Form.Item
            name="target_type"
            label="采集模式"
            rules={[{ required: true, message: '请选择采集模式' }]}
          >
            <Select style={{ width: 160 }} options={TARGET_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))} />
          </Form.Item>

          <Form.Item
            name="target_id"
            label="目标ID"
            rules={[{ required: true, message: '请输入目标ID' }]}
          >
            <Input
              placeholder={form.getFieldValue('target_type') === 'video' ? 'BVxxxxxx' : 'UID'}
              style={{ width: 180 }}
            />
          </Form.Item>

          <Form.Item
            name="fetch_limit"
            label="采集条数"
            rules={[{ required: true, message: '请输入采集条数' }]}
          >
            <InputNumber min={1} max={500} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<PlayCircleOutlined />}
              loading={submitting}
            >
              提交任务
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '16px 0 8px' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          <b>video 模式：</b>输入 BVID，直接抓取该视频的评论。
          <br />
          <b>up 模式：</b>输入 UP 主 UID，抓取其视频列表及所有评论。
        </Text>
      </Card>

      {/* 任务历史列表 */}
      <Card
        title="任务历史"
        size="small"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadTasks()}
            loading={loadingTasks}
            size="small"
          >
            手动刷新
          </Button>
        }
      >
        {runningCount > 0 && (
          <Alert
            message="轮询说明"
            description="后台正在每 3 秒自动刷新任务列表，直至无运行中任务。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          size="small"
          dataSource={tasks}
          columns={columns}
          rowKey="task_id"
          loading={loadingTasks}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          footer={() => (
            <Text type="secondary">共 {tasks.length} 条任务记录</Text>
          )}
        />
      </Card>
    </div>
  );
};

export default Ingestion;
