import React, { useState, useEffect } from 'react';
import { Card, Button, Checkbox, Table, Form, Input, InputNumber, Modal, message, Typography, Space, Tabs, Select, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { workerApi, itemApi, userApi } from '@/services/api';
import { Worker, Item, User, RoleEnum } from '@/types';
import { usePermission } from '@/store/useStore';

const { Title, TabPane } = Typography;

const Settings: React.FC = () => {
  const CLERK_PERMISSION_OPTIONS = [
    { label: '俱乐部收益', value: 'dashboard_view' },
    { label: '订单管理', value: 'orders_manage' },
    { label: '打手结算', value: 'settlement_manage' },
    { label: '明细查询', value: 'query_view' },
    { label: '基础设置', value: 'settings_manage' },
    { label: '删除操作', value: 'delete_action' },
  ];

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('workers');
  const [form] = Form.useForm();
  const { hasDeletePermission, isAdmin } = usePermission();
  const roleValue = Form.useWatch('role', form);

  // 获取打手表
  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await workerApi.getWorkers();
      setWorkers(data);
    } catch (error) {
      message.error('获取打手表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取物资表
  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await itemApi.getItems();
      setItems(data);
    } catch (error) {
      message.error('获取物资表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userApi.getUsers();
      setUsers(data);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    fetchItems();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // 打开新建打手模态框
  const handleAddWorker = () => {
    setEditingWorker(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑打手模态框
  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    form.setFieldsValue({
      name: worker.name,
      commission_rate: worker.commission_rate
    });
    setModalVisible(true);
  };

  // 删除打手
  const handleDeleteWorker = async (workerId: number) => {
    try {
      await workerApi.deleteWorker(workerId);
      message.success('打手删除成功');
      fetchWorkers();
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail;
      message.error(detail ? `打手删除失败：${detail}` : '打手删除失败');
    }
  };

  // 打开新建物资模态框
  const handleAddItem = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑物资模态框
  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    form.setFieldsValue({
      item_name: item.item_name,
      unit_qty: item.unit_qty,
      unit_price: item.unit_price
    });
    setModalVisible(true);
  };

  // 删除物资
  const handleDeleteItem = async (itemId: number) => {
    try {
      await itemApi.deleteItem(itemId);
      message.success('物资删除成功');
      fetchItems();
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail;
      message.error(detail ? `物资删除失败：${detail}` : '物资删除失败');
    }
  };

  // 打开新建用户模态框
  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      role: RoleEnum.CLERK,
      permissions_list: ['dashboard_view', 'orders_manage', 'settlement_manage', 'query_view'],
      is_active: true,
    });
    setModalVisible(true);
  };

  // 打开编辑用户模态框
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      permissions_list: (user.permissions || '').split(',').map((p) => p.trim()).filter(Boolean),
    });
    setModalVisible(true);
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    try {
      await userApi.deleteUser(userId);
      message.success('用户删除成功');
      fetchUsers();
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail;
      message.error(detail ? `用户删除失败：${detail}` : '用户删除失败');
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (activeTab === 'workers') {
        if (editingWorker) {
          // 更新打手
          await workerApi.updateWorker(editingWorker.id, values);
          message.success('打手更新成功');
        } else {
          // 创建打手
          await workerApi.createWorker(values);
          message.success('打手创建成功');
        }
        fetchWorkers();
      } else if (activeTab === 'items') {
        if (editingItem) {
          // 更新物资
          await itemApi.updateItem(editingItem.id, values);
          message.success('物资更新成功');
        } else {
          // 创建物资
          await itemApi.createItem(values);
          message.success('物资创建成功');
        }
        fetchItems();
      } else if (activeTab === 'users') {
        const submitValues = { ...values };
        if (submitValues.role === RoleEnum.CLERK) {
          const selected: string[] = submitValues.permissions_list || [];
          submitValues.permissions = selected.join(',');
        } else {
          submitValues.permissions = '';
        }
        delete submitValues.permissions_list;

        if (editingUser) {
          // 更新用户，排除空密码
          const updateValues = { ...submitValues };
          if (!updateValues.password) {
            delete updateValues.password;
          }
          // 更新用户
          await userApi.updateUser(editingUser.id, updateValues);
          message.success('用户更新成功');
        } else {
          // 创建用户
          await userApi.createUser(submitValues);
          message.success('用户创建成功');
        }
        fetchUsers();
      }
      setModalVisible(false);
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 打手表列定义
  const workerColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '抽成比例',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      render: (rate: number) => `${(rate * 100).toFixed(0)}%`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Worker) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditWorker(record)} />
          {hasDeletePermission && (
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small" 
              onClick={() => handleDeleteWorker(record.id)} 
            />
          )}
        </Space>
      ),
    },
  ];

  // 物资表列定义
  const itemColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '物资名称',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: '单位数量',
      dataIndex: 'unit_qty',
      key: 'unit_qty',
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => `¥${price}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Item) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditItem(record)} />
          {hasDeletePermission && (
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small" 
              onClick={() => handleDeleteItem(record.id)} 
            />
          )}
        </Space>
      ),
    },
  ];

  // 用户列表列定义
  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => role === RoleEnum.ADMIN ? '管理员' : '记账员',
    },
    {
      title: '功能权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string, record: User) => {
        if (record.role === RoleEnum.ADMIN) return '全部权限';
        const names = (permissions || '')
          .split(',')
          .map((p) => CLERK_PERMISSION_OPTIONS.find((o) => o.value === p.trim())?.label)
          .filter(Boolean);
        return names.length ? names.join(' / ') : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => isActive ? '激活' : '禁用',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditUser(record)} />
          {hasDeletePermission && (
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small" 
              onClick={() => handleDeleteUser(record.id)} 
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>基础设置</Title>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
        <TabPane tab="打手表" key="workers">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddWorker}>
              新建打手
            </Button>
          </div>
          <Card>
            <Table 
              columns={workerColumns} 
              dataSource={workers} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
        <TabPane tab="物资表" key="items">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
              新建物资
            </Button>
          </div>
          <Card>
            <Table 
              columns={itemColumns} 
              dataSource={items} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
        {isAdmin && (
          <TabPane tab="账号管理" key="users">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
                新建用户
              </Button>
            </div>
            <Card>
              <Table 
                columns={userColumns} 
                dataSource={users} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </TabPane>
        )}
      </Tabs>

      {/* 新建/编辑模态框 */}
      <Modal
        title={activeTab === 'workers' 
          ? (editingWorker ? '编辑打手' : '新建打手') 
          : activeTab === 'items'
          ? (editingItem ? '编辑物资' : '新建物资')
          : (editingUser ? '编辑用户' : '新建用户')
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          {activeTab === 'workers' ? (
            <>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item
                name="commission_rate"
                label="抽成比例"
                rules={[{ required: true, message: '请输入抽成比例' }]}
              >
                <InputNumber 
                  placeholder="请输入抽成比例" 
                  min={0} 
                  max={1} 
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </>
          ) : activeTab === 'items' ? (
            <>
              <Form.Item
                name="item_name"
                label="物资名称"
                rules={[{ required: true, message: '请输入物资名称' }]}
              >
                <Input placeholder="请输入物资名称" />
              </Form.Item>
              <Form.Item
                name="unit_qty"
                label="单位数量"
                rules={[{ required: true, message: '请输入单位数量' }]}
              >
                <InputNumber 
                  placeholder="请输入单位数量" 
                  min={0.01} 
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item
                name="unit_price"
                label="单价"
                rules={[{ required: true, message: '请输入单价' }]}
              >
                <InputNumber 
                  placeholder="请输入单价" 
                  min={0.01} 
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: !editingUser, message: '请输入密码' }]}
                tooltip={editingUser ? '留空表示不修改密码' : ''}
              >
                <Input.Password prefix={<LockOutlined />} placeholder={editingUser ? '留空表示不修改密码' : '请输入密码'} />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select placeholder="请选择角色">
                  <Select.Option value={RoleEnum.ADMIN}>管理员</Select.Option>
                  <Select.Option value={RoleEnum.CLERK}>记账员</Select.Option>
                </Select>
              </Form.Item>
              {roleValue === RoleEnum.CLERK && (
                <Form.Item
                  name="permissions_list"
                  label="记账员功能权限"
                  rules={[{ required: true, message: '请至少勾选一个功能' }]}
                >
                  <Checkbox.Group options={CLERK_PERMISSION_OPTIONS} />
                </Form.Item>
              )}
              <Form.Item
                name="is_active"
                label="状态"
                valuePropName="checked"
              >
                <Switch checkedChildren="激活" unCheckedChildren="禁用" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;