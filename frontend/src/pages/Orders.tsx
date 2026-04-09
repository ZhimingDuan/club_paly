import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Form, Input, Select, Modal, Popconfirm, message, Typography, Space, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { orderApi, workerApi, itemApi } from '@/services/api';
import { Order, Worker, Item } from '@/types';
import { usePermission } from '@/store/useStore';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [form] = Form.useForm();
  const { hasDeletePermission } = usePermission();

  // 获取订单列表
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await orderApi.getOrders();
      setOrders(data);
    } catch (error) {
      message.error('获取订单失败');
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

  // 获取物资表
  const fetchItems = async () => {
    try {
      const data = await itemApi.getItems();
      setItems(data);
    } catch (error) {
      message.error('获取物资表失败');
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchWorkers();
    fetchItems();
  }, []);

  // 打开新建订单模态框
  const handleAddOrder = () => {
    setEditingOrder(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑订单模态框
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    form.setFieldsValue({
      boss_name: order.boss_name,
      worker_id: order.worker_id ?? undefined,
      remarks: order.remarks,
      order_items: order.order_items.map(item => ({
        item_id: item.item_id,
        target_qty: item.target_qty,
        premium_rate: item.premium_rate
      }))
    });
    setModalVisible(true);
  };

  // 删除订单
  const handleDeleteOrder = async (orderId: number) => {
    try {
      await orderApi.deleteOrder(orderId);
      message.success('订单删除成功');
      fetchOrders();
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail;
      message.error(detail ? `订单删除失败：${detail}` : '订单删除失败');
    }
  };

  // 查看订单详情
  const handleViewOrder = (order: Order) => {
    setCurrentOrder(order);
    setDetailModalVisible(true);
  };

  // 提交订单表单
  const handleSubmit = async (values: any) => {
    try {
      if (editingOrder) {
        // 更新订单
        await orderApi.updateOrder(editingOrder.id, {
          boss_name: values.boss_name,
          worker_id: values.worker_id ?? null,
          remarks: values.remarks
        });
        message.success('订单更新成功');
      } else {
        // 创建订单
        await orderApi.createOrder({
          boss_name: values.boss_name,
          worker_id: values.worker_id ?? null,
          remarks: values.remarks,
          order_items: values.order_items
        });
        message.success('订单创建成功');
      }
      setModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 订单列表列定义
  const columns = [
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
      render: (worker: Worker | undefined) => worker?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => status === 'pending' ? '待结算' : '已完成',
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Order) => (
        <Space size="middle">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewOrder(record)} />
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditOrder(record)} />
          {hasDeletePermission && (
            <Popconfirm
              title="确认删除该订单？"
              description="删除后不可恢复"
              okText="确认"
              cancelText="取消"
              onConfirm={() => handleDeleteOrder(record.id)}
            >
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4}>订单管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddOrder}>
          新建订单
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={orders} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 新建/编辑订单模态框 */}
      <Modal
        title={editingOrder ? '编辑订单' : '新建订单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="boss_name"
            label="老板名称"
            rules={[{ required: true, message: '请输入老板名称' }]}
          >
            <Input placeholder="请输入老板名称" />
          </Form.Item>

          <Form.Item
            name="worker_id"
            label="打手"
          >
            <Select placeholder="请选择打手" allowClear>
              {workers.map(worker => (
                <Option key={worker.id} value={worker.id}>{worker.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="remarks"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item
            name="order_items"
            label="订单物资"
            rules={[{ required: true, message: '请添加至少一种物资' }]}
          >
            <Form.List name="order_items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...field}
                        name={[field.name, 'item_id']}
                        rules={[{ required: true, message: '请选择物资' }]}
                      >
                        <Select placeholder="选择物资" style={{ width: 150 }}>
                          {items.map(item => (
                            <Option key={item.id} value={item.id}>{item.item_name}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'target_qty']}
                        rules={[{ required: true, message: '请输入目标数量' }]}
                      >
                        <Input placeholder="目标数量(支持k/w)" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'premium_rate']}
                        initialValue={1.0}
                      >
                        <InputNumber placeholder="单价倍率" style={{ width: 120 }} min={0} step={0.1} />
                      </Form.Item>
                      <Button danger onClick={() => remove(field.name)}>-</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    <PlusOutlined /> 添加物资
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 订单详情模态框 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {currentOrder && (
          <div>
            <p><strong>订单ID:</strong> {currentOrder.id}</p>
            <p><strong>老板名称:</strong> {currentOrder.boss_name}</p>
            <p><strong>打手:</strong> {currentOrder.worker?.name}</p>
            <p><strong>状态:</strong> {currentOrder.status === 'pending' ? '待结算' : '已完成'}</p>
            <p><strong>创建时间:</strong> {currentOrder.create_time}</p>
            <p><strong>备注:</strong> {currentOrder.remarks || '-'}</p>
            
            <div style={{ marginTop: 20 }}>
              <h4>订单物资</h4>
              <Table 
                dataSource={currentOrder.order_items}
                rowKey="item_id"
                pagination={false}
              >
                <Table.Column title="物资名称" dataIndex="item" render={(item: Item) => item.item_name} />
                <Table.Column title="目标数量" dataIndex="target_qty" />
                <Table.Column title="单价倍率" dataIndex="premium_rate" />
              </Table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;