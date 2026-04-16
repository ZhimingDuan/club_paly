import React, { useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Input, Select, Space, Table, Typography, message, Button, Statistic, Grid } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { settlementApi } from '@/services/api';
import { Settlement } from '@/types';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const money = (v: number) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
};

const Query: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);

  const [bossKeyword, setBossKeyword] = useState('');
  const [itemKeyword, setItemKeyword] = useState('');
  const [workerId, setWorkerId] = useState<number | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>([null, null]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await settlementApi.getSettlements();
      setSettlements(data);
    } catch (e) {
      message.error('加载明细失败');
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
    // 明细查询按时间从新到旧
    return list.sort((a, b) => {
      const ta = new Date(a.settlement_time).getTime();
      const tb = new Date(b.settlement_time).getTime();
      return tb - ta;
    });
  }, [rows, bossKeyword, itemKeyword, workerId, dateRange]);

  const summary = useMemo(() => {
    const totalWorkerPay = filtered.reduce((acc, r) => acc + (r.worker_pay || 0), 0);
    const totalClubCut = filtered.reduce((acc, r) => acc + (r.club_cut || 0), 0);
    const totalValue = filtered.reduce((acc, r) => acc + (r.total_value || 0), 0);
    return { totalWorkerPay, totalClubCut, totalValue };
  }, [filtered]);

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
    },
    { title: '老板', dataIndex: 'boss_name', key: 'boss_name', width: 140 },
    { title: '打手', dataIndex: 'worker_name', key: 'worker_name', width: 130 },
    { title: '物资', dataIndex: 'item_name', key: 'item_name', width: 130 },
    { title: '提交数量', dataIndex: 'submit_qty', key: 'submit_qty', width: 110 },
    { title: '总价值', dataIndex: 'total_value', key: 'total_value', width: 130, render: (v: number) => money(v) },
    { title: '打手结算金额', dataIndex: 'worker_pay', key: 'worker_pay', width: 140, render: (v: number) => money(v) },
    { title: '俱乐部分成', dataIndex: 'club_cut', key: 'club_cut', width: 130, render: (v: number) => money(v) },
  ];

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

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <Card>
          <Statistic title="打手结算金额合计" value={summary.totalWorkerPay} precision={2} formatter={(v) => money(Number(v || 0))} />
        </Card>
        <Card>
          <Statistic title="俱乐部分成合计" value={summary.totalClubCut} precision={2} formatter={(v) => money(Number(v || 0))} />
        </Card>
        <Card>
          <Statistic title="总价值合计" value={summary.totalValue} precision={2} formatter={(v) => money(Number(v || 0))} />
        </Card>
      </div>

      <Card>
        {!isMobile ? (
          <Table
            columns={columns as any}
            dataSource={filtered}
            rowKey="row_id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1300 }}
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((r) => (
              <Card key={r.row_id} size="small" style={{ borderRadius: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.item_name} / {r.worker_name}</div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  结算 {r.settlement_display_id} · 订单 {r.order_display_id}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  老板：{r.boss_name} · 时间：{zhDateTime(r.settlement_time)}
                </div>
                <div style={{ fontSize: 13 }}>
                  数量 {r.submit_qty} ｜ 总价值 {money(r.total_value)}
                </div>
                <div style={{ fontSize: 13 }}>
                  打手结算 {money(r.worker_pay)} ｜ 俱乐部分成 {money(r.club_cut)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Query;

