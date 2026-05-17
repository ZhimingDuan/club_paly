import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Typography,
  message,
  Button,
  Grid,
  Tag,
  Checkbox,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { settlementApi, orderApi, getApiErrorMessage } from '@/services/api';
import { Order, Settlement } from '@/types';
import { usePermission } from '@/store/useStore';
import OrderDetailModal from '@/components/OrderDetailModal';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const money = (v: number) =>
  `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const zhDateTime = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const toDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

type DateRange = [Date | null, Date | null];
type SettlementRow = {
  row_id: string;
  settlement_item_id: number;
  settlement_id: number;
  settlement_display_id: string;
  settlement_time: string;
  order_id: number;
  order_display_id: string;
  order_create_time: string;
  boss_name: string;
  worker_id: number;
  worker_name: string;
  item_name: string;
  submit_qty: number;
  total_value: number;
  worker_pay: number;
  club_cut: number;
  is_paid: boolean;
};

const Query: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { isAdmin } = usePermission();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [bossKeyword, setBossKeyword] = useState('');
  const [itemKeyword, setItemKeyword] = useState('');
  const [workerId, setWorkerId] = useState<number | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>([null, null]);

  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await settlementApi.getSettlements();
      setSettlements(data);
    } catch (e: unknown) {
      message.error(getApiErrorMessage(e, '加载明细失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const rows = useMemo<SettlementRow[]>(() => {
    return settlements.flatMap((settlement) =>
      (settlement.settlement_items || []).map((item) => ({
        row_id: `${settlement.id}-${item.id}`,
        settlement_item_id: item.id,
        settlement_id: settlement.id,
        settlement_display_id: settlement.display_id || String(settlement.id),
        settlement_time: settlement.datetime,
        order_id: settlement.order_id,
        order_display_id: settlement.order?.display_id || String(settlement.order_id),
        order_create_time: settlement.order?.create_time || settlement.datetime,
        boss_name: settlement.order?.boss_name || '-',
        worker_id: settlement.worker_id,
        worker_name: settlement.worker?.name || '-',
        item_name: item.item?.item_name || '-',
        submit_qty: Number(item.submit_qty || 0),
        total_value: Number(item.total_value || 0),
        worker_pay: Number(item.worker_pay || 0),
        club_cut: Number(item.club_cut || 0),
        is_paid: Boolean(item.is_paid),
      }))
    );
  }, [settlements]);

  const workerOptions = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((r) => {
      if (!map.has(r.worker_id)) map.set(r.worker_id, r.worker_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const bossKw = bossKeyword.trim().toLowerCase();
    const itemKw = itemKeyword.trim().toLowerCase();
    const [start, end] = dateRange;
    const startTs = start ? new Date(start).setHours(0, 0, 0, 0) : null;
    const endTs = end ? new Date(end).setHours(23, 59, 59, 999) : null;

    const list = rows.filter((r) => {
      if (bossKw && !String(r.boss_name || '').toLowerCase().includes(bossKw)) return false;
      if (itemKw && !String(r.item_name || '').toLowerCase().includes(itemKw)) return false;
      if (workerId !== 'all' && r.worker_id !== workerId) return false;

      if (startTs || endTs) {
        const d = toDate(r.settlement_time);
        if (!d) return false;
        const ts = d.getTime();
        if (startTs && ts < startTs) return false;
        if (endTs && ts > endTs) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const ta = new Date(a.settlement_time).getTime();
      const tb = new Date(b.settlement_time).getTime();
      return tb - ta;
    });
  }, [rows, bossKeyword, itemKeyword, workerId, dateRange]);

  const rowById = useMemo(() => {
    const map = new Map<string, SettlementRow>();
    filtered.forEach((r) => map.set(r.row_id, r));
    return map;
  }, [filtered]);

  const selectedRows = useMemo(
    () =>
      selectedRowKeys
        .map((k) => rowById.get(String(k)))
        .filter((r): r is SettlementRow => Boolean(r)),
    [selectedRowKeys, rowById]
  );

  const selectedUnpaidRows = useMemo(
    () => selectedRows.filter((r) => !r.is_paid),
    [selectedRows]
  );

  const workerPaySummary = useMemo(() => {
    const map = new Map<number, { name: string; total: number }>();
    selectedUnpaidRows.forEach((r) => {
      const cur = map.get(r.worker_id) || { name: r.worker_name, total: 0 };
      cur.total += r.worker_pay;
      map.set(r.worker_id, cur);
    });
    return Array.from(map.values());
  }, [selectedUnpaidRows]);

  const handleOpenOrderDetail = async (orderId: number) => {
    try {
      setOrderDetailOpen(true);
      setOrderDetailLoading(true);
      setOrderDetail(null);
      const order = await orderApi.getOrder(orderId);
      setOrderDetail(order);
    } catch (e: unknown) {
      message.error(getApiErrorMessage(e, '获取订单详情失败'));
      setOrderDetailOpen(false);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const handleMarkPaid = useCallback(
    async (settlementItemIds: number[]) => {
      if (!settlementItemIds.length) {
        message.warning('请选择未结清的明细');
        return;
      }
      try {
        setMarking(true);
        const res = await settlementApi.markSettlementItemsPaid(settlementItemIds);
        message.success(`已结清 ${res.updated_count} 条明细`);
        setSelectedRowKeys([]);
        await fetchAll();
      } catch (e: unknown) {
        message.error(getApiErrorMessage(e, '结清失败'));
      } finally {
        setMarking(false);
      }
    },
    []
  );

  const renderPaidCell = (record: SettlementRow) => {
    if (!isAdmin) return null;
    if (record.is_paid) {
      return <Tag color="success">已结清</Tag>;
    }
    return (
      <Button
        type="link"
        size="small"
        loading={marking}
        onClick={() => handleMarkPaid([record.settlement_item_id])}
      >
        结清
      </Button>
    );
  };

  const columns = [
    {
      title: '结算ID',
      dataIndex: 'settlement_display_id',
      key: 'settlement_id',
      width: 120,
    },
    {
      title: '时间',
      dataIndex: 'settlement_time',
      key: 'settlement_time',
      width: 180,
      render: (v: string) => zhDateTime(v),
    },
    {
      title: '订单ID',
      dataIndex: 'order_display_id',
      key: 'order_id',
      width: 120,
      render: (v: string, record: SettlementRow) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => handleOpenOrderDetail(record.order_id)}>
          {v}
        </Button>
      ),
    },
    { title: '老板', dataIndex: 'boss_name', key: 'boss_name', width: 140 },
    { title: '打手', dataIndex: 'worker_name', key: 'worker_name', width: 130 },
    { title: '物资', dataIndex: 'item_name', key: 'item_name', width: 130 },
    { title: '提交数量', dataIndex: 'submit_qty', key: 'submit_qty', width: 110 },
    { title: '总价值', dataIndex: 'total_value', key: 'total_value', width: 130, render: (v: number) => money(v) },
    { title: '打手结算金额', dataIndex: 'worker_pay', key: 'worker_pay', width: 140, render: (v: number) => money(v) },
    { title: '俱乐部分成', dataIndex: 'club_cut', key: 'club_cut', width: 130, render: (v: number) => money(v) },
    ...(isAdmin
      ? [
          {
            title: '是否结清',
            key: 'is_paid',
            width: 100,
            fixed: 'right' as const,
            render: (_: unknown, record: SettlementRow) => renderPaidCell(record),
          },
        ]
      : []),
  ];

  const rowSelection = isAdmin
    ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
        getCheckboxProps: (record: SettlementRow) => ({
          disabled: record.is_paid,
        }),
      }
    : undefined;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          明细查询
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
          刷新
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ color: '#666', marginBottom: 6 }}>老板名称</div>
            <Input
              placeholder="输入关键字"
              value={bossKeyword}
              onChange={(e) => setBossKeyword(e.target.value)}
              style={{ width: isMobile ? '100%' : 220 }}
              allowClear
            />
          </div>

          <div>
            <div style={{ color: '#666', marginBottom: 6 }}>物资关键字</div>
            <Input
              placeholder="输入物资关键字"
              value={itemKeyword}
              onChange={(e) => setItemKeyword(e.target.value)}
              style={{ width: isMobile ? '100%' : 220 }}
              allowClear
            />
          </div>

          <div>
            <div style={{ color: '#666', marginBottom: 6 }}>打手</div>
            <Select value={workerId} onChange={(v) => setWorkerId(v)} style={{ width: isMobile ? '100%' : 200 }}>
              <Option value="all">全部</Option>
              {workerOptions.map((w) => (
                <Option key={w.id} value={w.id}>
                  {w.name}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ color: '#666', marginBottom: 6 }}>结算时间</div>
            <RangePicker
              onChange={(dates) => {
                const a = (dates?.[0]?.toDate?.() ?? null) as Date | null;
                const b = (dates?.[1]?.toDate?.() ?? null) as Date | null;
                setDateRange([a, b]);
              }}
            />
          </div>

          <div style={{ marginLeft: isMobile ? 0 : 'auto', color: '#666' }}>
            共 <b>{filtered.length}</b> 条
          </div>
        </Space>
      </Card>

      {isAdmin && selectedUnpaidRows.length > 0 && (
        <Card style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div>
              已勾选 <b>{selectedUnpaidRows.length}</b> 条未结清明细，打手应付合计：
              {workerPaySummary.map((w) => (
                <span key={w.name} style={{ marginLeft: 12 }}>
                  {w.name}：{money(w.total)}
                </span>
              ))}
            </div>
            <Button
              type="primary"
              loading={marking}
              onClick={() =>
                handleMarkPaid(selectedUnpaidRows.map((r) => r.settlement_item_id))
              }
            >
              批量结清
            </Button>
          </Space>
        </Card>
      )}

      <Card>
        {!isMobile ? (
          <Table
            columns={columns as any}
            dataSource={filtered}
            rowKey="row_id"
            loading={loading}
            rowSelection={rowSelection}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: isAdmin ? 1450 : 1300 }}
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((r) => (
              <Card key={r.row_id} size="small" style={{ borderRadius: 10 }}>
                {isAdmin && !r.is_paid && (
                  <Checkbox
                    checked={selectedRowKeys.includes(r.row_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowKeys((prev) => [...prev, r.row_id]);
                      } else {
                        setSelectedRowKeys((prev) => prev.filter((k) => k !== r.row_id));
                      }
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    勾选
                  </Checkbox>
                )}
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {r.item_name} / {r.worker_name}
                  {isAdmin && r.is_paid && (
                    <Tag color="success" style={{ marginLeft: 8 }}>
                      已结清
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  结算 {r.settlement_display_id} · 订单{' '}
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                    onClick={() => handleOpenOrderDetail(r.order_id)}
                  >
                    {r.order_display_id}
                  </Button>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  老板：{r.boss_name} · 时间：{zhDateTime(r.settlement_time)}
                </div>
                <div style={{ fontSize: 13 }}>
                  数量 {r.submit_qty} ｜ 总价值 {money(r.total_value)}
                </div>
                <div style={{ fontSize: 13, marginBottom: isAdmin && !r.is_paid ? 8 : 0 }}>
                  打手结算 {money(r.worker_pay)} ｜ 俱乐部分成 {money(r.club_cut)}
                </div>
                {isAdmin && !r.is_paid && (
                  <Button
                    size="small"
                    type="primary"
                    loading={marking}
                    onClick={() => handleMarkPaid([r.settlement_item_id])}
                  >
                    结清
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <OrderDetailModal
        open={orderDetailOpen}
        order={orderDetail}
        loading={orderDetailLoading}
        onClose={() => {
          setOrderDetailOpen(false);
          setOrderDetail(null);
        }}
      />
    </div>
  );
};

export default Query;
