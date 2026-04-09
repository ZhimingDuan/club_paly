import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Form, Select, Input, message, Typography, Space, Divider, Checkbox, Progress, Popconfirm, Grid } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { orderApi, settlementApi, workerApi } from '@/services/api';
import { Order, Worker, Item, OrderItem } from '@/types';
import { usePermission } from '@/store/useStore';

const { Title } = Typography;
const { Option } = Select;

const Settlement: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const { isAdmin } = usePermission();
  const [settlementItems, setSettlementItems] = useState<Array<{
    order_id: number;
    item_id: number;
    submit_qty: string;
    target_qty: number;
    delivered_qty: number;
    remaining_qty: number;
    premium_rate: number;
    item: Item;
    worker_id: number | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 获取待结算订单
  const fetchPendingOrders = async () => {
    try {
      setLoading(true);
      const data = await orderApi.getPendingOrders();
      setPendingOrders(data);
    } catch (error) {
      message.error('获取待结算订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取打手表
  const fetchWorkers = async () => {
    try {
      const data = await workerApi.getWorkers();
      setWorkers(data);
    } catch (error) {
      message.error('获取打手表失败');
    }
  };

  useEffect(() => {
    fetchPendingOrders();
    fetchWorkers();
  }, []);

  const parseQty = (raw: string | number | null | undefined): number => {
    const text = String(raw ?? '').trim().toLowerCase();
    if (!text) return 0;
    let base = text;
    let mul = 1;
    if (text.endsWith('w')) {
      base = text.slice(0, -1);
      mul = 10000;
    } else if (text.endsWith('k')) {
      base = text.slice(0, -1);
      mul = 1000;
    }
    const n = Number(base);
    return Number.isFinite(n) ? n * mul : 0;
  };

  // 选择订单
  const handleOrderSelect = (orderId: number, checked: boolean) => {
    let newSelectedOrders: Order[];
    if (checked) {
      const order = pendingOrders.find(o => o.id === orderId);
      if (order) {
        newSelectedOrders = [...selectedOrders, order];
      } else {
        newSelectedOrders = selectedOrders;
      }
    } else {
      newSelectedOrders = selectedOrders.filter(order => order.id !== orderId);
    }
    setSelectedOrders(newSelectedOrders);
    
    // 初始化结算物资
    const items = newSelectedOrders.flatMap(order => 
      order.order_items.map(orderItem => ({
        order_id: order.id,
        item_id: orderItem.item_id,
        submit_qty: '',
        target_qty: orderItem.target_qty,
        delivered_qty: orderItem.delivered_qty || 0,
        remaining_qty: Math.max((orderItem.target_qty || 0) - (orderItem.delivered_qty || 0), 0),
        premium_rate: orderItem.premium_rate ?? 1.0,
        item: orderItem.item,
        worker_id: null
      }))
    );
    setSettlementItems(items);
  };

  // 计算物资价值
  const calculateValue = (item: Item, submit_qtyRaw: string, worker_id: number, premium_rate: number, remainingQty: number) => {
    const worker = workers.find(w => w.id === worker_id);
    if (!worker) return { total_value: 0, worker_pay: 0, club_cut: 0 };

    const submitQty = parseQty(submit_qtyRaw);
    const effectiveQty = Math.min(Math.max(submitQty, 0), Math.max(remainingQty || 0, 0));
    const total_value = (effectiveQty / item.unit_qty) * item.unit_price * (premium_rate || 1);

    if (!item.is_commissioned) {
      return { total_value, worker_pay: total_value, club_cut: 0 };
    }

    const worker_pay = total_value * worker.commission_rate;
    const club_cut = total_value - worker_pay;
    return { total_value, worker_pay, club_cut };
  };

  // 更新提交数量
  const handleSubmitQtyChange = (index: number, value: string) => {
    const newItems = [...settlementItems];
    newItems[index].submit_qty = value;
    setSettlementItems(newItems);
  };

  const getQtyHint = (submitQtyRaw: string, remainingQty: number) => {
    const qty = parseQty(submitQtyRaw);
    if (!submitQtyRaw) return '';
    if (qty < 0) return '数量不能小于0';
    if (qty > remainingQty) return `超出剩余，提交时将自动按 ${remainingQty} 截断`;
    return '';
  };

  // 提交结算
  const handleSubmit = async (values: any) => {
    try {
      if (selectedOrders.length === 0) {
        message.error('请选择订单');
        return;
      }

      // 允许输入 0；只有数量 > 0 的行才要求选择打手
      const hasInvalidRow = settlementItems.some(item => parseQty(item.submit_qty) > 0 && !item.worker_id);
      if (hasInvalidRow) {
        message.error('请为已填写数量的物资选择打手');
        return;
      }

      const hasAnyPositive = settlementItems.some(item => parseQty(item.submit_qty) > 0);
      if (!hasAnyPositive) {
        message.error('请至少填写一条大于0的完成数量');
        return;
      }

      setLoading(true);
      
      // 支持同一订单选择多个打手：按 (order_id, worker_id) 分组分别提交结算
      const groups = new Map<string, { order_id: number; worker_id: number; items: Array<{ item_id: number; submit_qty: string }> }>();
      
      settlementItems.forEach(item => {
        const qty = parseQty(item.submit_qty);
        if (qty <= 0 || !item.worker_id) return;
        const worker_id = item.worker_id as number;
        const key = `${item.order_id}-${worker_id}`;
        if (!groups.has(key)) {
          groups.set(key, { order_id: item.order_id, worker_id, items: [] });
        }
        groups.get(key)!.items.push({ item_id: item.item_id, submit_qty: item.submit_qty });
      });

      if (groups.size === 0) {
        message.error('没有可提交的结算项');
        return;
      }

      // 批量提交结算
      const settlementPromises = Array.from(groups.values()).map(({ order_id, worker_id, items }) => {
        return settlementApi.createSettlement({
          order_id,
          worker_id,
          settlement_items: items
        });
      });

      await Promise.all(settlementPromises);
      message.success('提交成功（系统将累计数量，达标后自动结单）');
      // 重新获取待结算订单
      await fetchPendingOrders();
      // 重置表单
      setSelectedOrders([]);
      setSettlementItems([]);
      form.resetFields();
    } catch (error) {
      message.error('结算失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSplitRow = (index: number) => {
    const row = settlementItems[index];
    const newRow = { ...row, submit_qty: '', worker_id: null };
    const next = [...settlementItems];
    next.splice(index + 1, 0, newRow);
    setSettlementItems(next);
  };

  const handleRemoveRow = (index: number) => {
    const next = settlementItems.filter((_, i) => i !== index);
    setSettlementItems(next);
  };

  const handleForceComplete = async (orderId: number) => {
    try {
      setLoading(true);
      await orderApi.forceComplete(orderId);
      message.success('已强制结单');
      await fetchPendingOrders();
      // 如果当前选中里包含该订单，移除它并重建右侧结算行
      const remain = selectedOrders.filter(o => o.id !== orderId);
      setSelectedOrders(remain);
      const items = remain.flatMap(order =>
        order.order_items.map(orderItem => ({
          order_id: order.id,
          item_id: orderItem.item_id,
          submit_qty: '',
          target_qty: orderItem.target_qty,
          delivered_qty: orderItem.delivered_qty || 0,
          remaining_qty: Math.max((orderItem.target_qty || 0) - (orderItem.delivered_qty || 0), 0),
          premium_rate: orderItem.premium_rate ?? 1.0,
          item: orderItem.item,
          worker_id: null
        }))
      );
      setSettlementItems(items);
    } catch (e) {
      message.error('强制结单失败（需要管理员权限）');
    } finally {
      setLoading(false);
    }
  };

  // 订单列表列定义
  const orderColumns = [
    {
      title: (
        <Checkbox 
          onChange={(e) => {
            // 全选/取消全选
            if (e.target.checked) {
              setSelectedOrders(pendingOrders);
              // 初始化结算物资
              const items = pendingOrders.flatMap(order => 
                order.order_items.map(orderItem => ({
                  order_id: order.id,
                  item_id: orderItem.item_id,
                  submit_qty: '',
                  target_qty: orderItem.target_qty,
                  delivered_qty: orderItem.delivered_qty || 0,
                  remaining_qty: Math.max((orderItem.target_qty || 0) - (orderItem.delivered_qty || 0), 0),
                  premium_rate: orderItem.premium_rate ?? 1.0,
                  item: orderItem.item,
                  worker_id: null
                }))
              );
              setSettlementItems(items);
            } else {
              setSelectedOrders([]);
              setSettlementItems([]);
            }
          }}
        />
      ),
      dataIndex: 'id',
      key: 'checkbox',
      render: (id: number) => (
        <Checkbox 
          checked={selectedOrders.some(order => order.id === id)}
          onChange={(e) => handleOrderSelect(id, e.target.checked)}
        />
      ),
    },
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '老板名称',
      dataIndex: 'boss_name',
      key: 'boss_name',
    },
    {
      title: '打手',
      dataIndex: 'worker',
      key: 'worker',
      render: (worker: Worker | null) => worker?.name || '-',
    },
    {
      title: '进度',
      key: 'progress',
      render: (_: any, record: Order) => {
        const items: OrderItem[] = record.order_items || [];
        if (items.length === 0) return '-';
        const avg =
          items.reduce((sum, oi) => {
            const delivered = oi.delivered_qty ?? 0;
            const target = oi.target_qty || 0;
            const pct = target > 0 ? Math.min(100, (delivered / target) * 100) : 0;
            return sum + pct;
          }, 0) / items.length;
        return (
          <div style={{ minWidth: 160 }}>
            <Progress percent={Number(avg.toFixed(0))} size="small" />
            <div style={{ marginTop: 4, display: 'grid', gap: 4 }}>
              {items.slice(0, 3).map((oi) => {
                const delivered = oi.delivered_qty ?? 0;
                const target = oi.target_qty || 0;
                const pct = target > 0 ? Math.min(100, (delivered / target) * 100) : 0;
                return (
                  <div key={oi.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: '#666' }}>{oi.item.item_name}</span>
                    <span style={{ color: '#999' }}>
                      {delivered}/{target} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
              {items.length > 3 && <div style={{ color: '#999' }}>… 还有 {items.length - 3} 项</div>}
            </div>
          </div>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
    },
    {
      title: '操作',
      key: 'ops',
      render: (_: any, record: Order) =>
        isAdmin ? (
          <Popconfirm
            title="强制结单"
            description="将直接把订单置为已完成，即使数量未达标。确定继续？"
            onConfirm={() => handleForceComplete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger size="small">
              强制结单
            </Button>
          </Popconfirm>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
  ];

  return (
    <div>
      <Title level={4}>打手结算</Title>
      
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 24, marginBottom: 24 }}>
        {/* 左侧订单选择 */}
        <Card title="待结算订单">
          <Table 
            columns={orderColumns} 
            dataSource={pendingOrders} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 5 }}
            scroll={{ x: 900 }}
            onRow={(record) => ({
              onClick: () => {
                const isSelected = selectedOrders.some(order => order.id === record.id);
                // 行点击时也同步切换选中状态（checkbox 的 onChange 逻辑保持不变）
                handleOrderSelect(record.id, !isSelected);
              },
              style: selectedOrders.some(order => order.id === record.id) ? { backgroundColor: '#e6f7ff' } : {}
            })}
          />
        </Card>

        {/* 右侧结算信息 */}
        <Card title="结算详情">
          {selectedOrders.length > 0 ? (
            <Form
              form={form}
              onFinish={handleSubmit}
              layout="vertical"
            >
              <Divider orientation="left">物资结算</Divider>
              {!isMobile ? (
                <Table 
                  dataSource={settlementItems}
                  rowKey={(_, index) => String(index)}
                  pagination={false}
                  scroll={{ x: 1300 }}
                >
                  <Table.Column title="订单ID" dataIndex="order_id" />
                  <Table.Column title="物资名称" dataIndex="item" render={(item: Item) => item.item_name} />
                  <Table.Column title="目标数量" dataIndex="target_qty" />
                  <Table.Column title="已完成" dataIndex="delivered_qty" />
                  <Table.Column title="剩余可结算" dataIndex="remaining_qty" />
                  <Table.Column title="单价倍率" dataIndex="premium_rate" />
                  <Table.Column title="单位" dataIndex="item" render={(item: Item) => item.unit_qty} />
                  <Table.Column title="单价" dataIndex="item" render={(item: Item) => `¥${item.unit_price}`} />
                  <Table.Column 
                    title="完成数量" 
                    render={(text, record, index) => (
                      <div>
                        <Input
                          style={{ width: 120 }}
                          value={record.submit_qty}
                          onChange={(e) => handleSubmitQtyChange(index, e.target.value)}
                          placeholder="支持 0/k/w"
                        />
                        {getQtyHint(record.submit_qty, record.remaining_qty) ? (
                          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                            {getQtyHint(record.submit_qty, record.remaining_qty)}
                          </div>
                        ) : null}
                      </div>
                    )} 
                  />
                  <Table.Column 
                    title="打手" 
                    render={(text, record, index) => (
                      <Select 
                        style={{ width: 120 }} 
                        value={record.worker_id}
                        onChange={(value) => {
                          const newItems = [...settlementItems];
                          newItems[index].worker_id = value;
                          setSettlementItems(newItems);
                        }}
                        placeholder="选择打手"
                      >
                        {workers.map(worker => (
                          <Option key={worker.id} value={worker.id}>{worker.name}</Option>
                        ))}
                      </Select>
                    )} 
                  />
                  <Table.Column
                    title="分配"
                    render={(_: any, __: any, index: number) => (
                      <Space>
                        <Button size="small" onClick={() => handleSplitRow(index)}>
                          新增行
                        </Button>
                        <Button size="small" danger onClick={() => handleRemoveRow(index)}>
                          删除
                        </Button>
                      </Space>
                    )}
                  />
                  <Table.Column 
                    title="物资价值" 
                    render={(text, record) => {
                      const { total_value } = calculateValue(record.item, record.submit_qty, record.worker_id, record.premium_rate, record.remaining_qty);
                      return `¥${total_value.toFixed(2)}`;
                    }} 
                  />
                  <Table.Column 
                    title="打手应得" 
                    render={(text, record) => {
                      const { worker_pay } = calculateValue(record.item, record.submit_qty, record.worker_id, record.premium_rate, record.remaining_qty);
                      return `¥${worker_pay.toFixed(2)}`;
                    }} 
                  />
                  <Table.Column 
                    title="俱乐部抽成" 
                    render={(text, record) => {
                      const { club_cut } = calculateValue(record.item, record.submit_qty, record.worker_id, record.premium_rate, record.remaining_qty);
                      return `¥${club_cut.toFixed(2)}`;
                    }} 
                  />
                </Table>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {settlementItems.map((record, index) => {
                    const calc = calculateValue(record.item, record.submit_qty, record.worker_id ?? -1, record.premium_rate, record.remaining_qty);
                    return (
                      <Card key={`${record.order_id}-${record.item_id}-${index}`} size="small" style={{ borderRadius: 10 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{record.item.item_name}（订单 {record.order_id}）</div>
                        <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                          目标 {record.target_qty} / 已完成 {record.delivered_qty} / 剩余 {record.remaining_qty}
                        </div>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Input
                            value={record.submit_qty}
                            onChange={(e) => handleSubmitQtyChange(index, e.target.value)}
                            placeholder="完成数量（支持 0/k/w）"
                          />
                          <Select
                            value={record.worker_id}
                            onChange={(value) => {
                              const newItems = [...settlementItems];
                              newItems[index].worker_id = value;
                              setSettlementItems(newItems);
                            }}
                            placeholder="选择打手"
                          >
                            {workers.map(worker => (
                              <Option key={worker.id} value={worker.id}>{worker.name}</Option>
                            ))}
                          </Select>
                          {getQtyHint(record.submit_qty, record.remaining_qty) ? (
                            <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                              {getQtyHint(record.submit_qty, record.remaining_qty)}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 12, color: '#666' }}>
                            物资价值 {calc.total_value.toFixed(2)} / 打手应得 {calc.worker_pay.toFixed(2)} / 俱乐部抽成 {calc.club_cut.toFixed(2)}
                          </div>
                          <Space>
                            <Button size="small" onClick={() => handleSplitRow(index)}>新增行</Button>
                            <Button size="small" danger onClick={() => handleRemoveRow(index)}>删除</Button>
                          </Space>
                        </Space>
                      </Card>
                    );
                  })}
                </div>
              )}

              <Divider orientation="left">合并汇总（按打手）</Divider>
              <Table
                dataSource={Array.from(
                  settlementItems.reduce((map, row) => {
                    if (!row.worker_id) return map;
                    const workerId = row.worker_id as number;
                    const worker = workers.find(w => w.id === row.worker_id) || null;
                    const key = `${workerId}-${row.item_id}`;
                    const v = map.get(key) || {
                      worker_id: workerId,
                      worker_name: worker?.name || String(row.worker_id),
                      item_id: row.item_id,
                      item_name: row.item.item_name,
                      submit_qty: 0,
                      total_value: 0,
                      worker_pay: 0,
                      club_cut: 0,
                    };
                    const calc = calculateValue(row.item, row.submit_qty, workerId, row.premium_rate, row.remaining_qty);
                    v.submit_qty += Math.min(parseQty(row.submit_qty), row.remaining_qty || 0);
                    v.total_value += calc.total_value;
                    v.worker_pay += calc.worker_pay;
                    v.club_cut += calc.club_cut;
                    map.set(key, v);
                    return map;
                  }, new Map<string, any>())
                ).map(([, v]) => v)}
                rowKey={(r: any) => `${r.worker_id}-${r.item_id}`}
                pagination={false}
                size="small"
                scroll={{ x: 900 }}
              >
                <Table.Column title="打手" dataIndex="worker_name" />
                <Table.Column title="物资" dataIndex="item_name" />
                <Table.Column title="合计数量" dataIndex="submit_qty" />
                <Table.Column title="物资价值" dataIndex="total_value" render={(v: number) => `¥${v.toFixed(2)}`} />
                <Table.Column title="打手应得" dataIndex="worker_pay" render={(v: number) => `¥${v.toFixed(2)}`} />
                <Table.Column title="俱乐部抽成" dataIndex="club_cut" render={(v: number) => `¥${v.toFixed(2)}`} />
              </Table>

              <Form.Item style={isMobile ? { position: 'sticky', bottom: 8, background: 'rgba(255,255,255,0.96)', paddingTop: 8, marginBottom: 0 } : undefined}>
                <Button type="primary" htmlType="submit" icon={<CheckOutlined />} loading={loading}>
                  提交结算
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p>请从左侧选择待结算的订单</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Settlement;