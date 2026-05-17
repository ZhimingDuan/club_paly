import React from 'react';
import { Modal, Button, Table } from 'antd';
import { Order, Item } from '@/types';

const zhDateTime = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v || '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

interface OrderDetailModalProps {
  open: boolean;
  order: Order | null;
  loading?: boolean;
  onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  open,
  order,
  loading = false,
  onClose,
}) => (
  <Modal
    title="订单详情"
    open={open}
    onCancel={onClose}
    footer={[
      <Button key="close" onClick={onClose}>
        关闭
      </Button>,
    ]}
  >
    {loading ? (
      <div>加载中...</div>
    ) : order ? (
      <div>
        <p>
          <strong>订单ID:</strong> {order.display_id || order.id}
        </p>
        <p>
          <strong>老板名称:</strong> {order.boss_name}
        </p>
        <p>
          <strong>打手:</strong> {order.worker?.name || '-'}
        </p>
        <p>
          <strong>状态:</strong> {order.status === 'pending' ? '待结算' : '已完成'}
        </p>
        <p>
          <strong>创建时间:</strong> {zhDateTime(order.create_time)}
        </p>
        <p>
          <strong>备注:</strong> {order.remarks || '-'}
        </p>
        <div style={{ marginTop: 20 }}>
          <h4>订单物资</h4>
          <Table dataSource={order.order_items} rowKey="id" pagination={false} size="small">
            <Table.Column title="物资名称" dataIndex="item" render={(item: Item) => item?.item_name || '-'} />
            <Table.Column title="目标数量" dataIndex="target_qty" />
            <Table.Column title="单价倍率" dataIndex="premium_rate" />
          </Table>
        </div>
      </div>
    ) : null}
  </Modal>
);

export default OrderDetailModal;
