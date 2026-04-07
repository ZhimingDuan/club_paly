import React, { useEffect } from 'react';
import { Layout, Menu, Button, Badge, Typography } from 'antd';
import { LogoutOutlined, HomeOutlined, OrderedListOutlined, DollarOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore, usePermission } from '@/store/useStore';
import { userApi } from '@/services/api';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, setUser } = useStore();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取当前用户信息
  useEffect(() => {
    // 暂时注释掉API请求，确保前端功能可以正常工作
    // const fetchCurrentUser = async () => {
    //   try {
    //     console.log('开始获取用户信息');
    //     const userInfo = await userApi.getCurrentUser();
    //     console.log('获取用户信息成功:', userInfo);
    //     setUser(userInfo);
    //   } catch (error) {
    //     console.error('获取用户信息失败', error);
    //     // 即使获取用户信息失败，也不影响组件渲染
    //   }
    // };

    // fetchCurrentUser();
  }, [setUser]);

  const handleLogout = () => {
    console.log('退出登录按钮被点击');
    logout();
    navigate('/login');
  };

  // 菜单项
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '俱乐部收益',
      perm: 'dashboard_view',
    },
    {
      key: '/orders',
      icon: <OrderedListOutlined />,
      label: '订单管理',
      perm: 'orders_manage',
    },
    {
      key: '/settlement',
      icon: <DollarOutlined />,
      label: '打手结算',
      perm: 'settlement_manage',
    },
    {
      key: '/query',
      icon: <SearchOutlined />,
      label: '明细查询',
      perm: 'query_view',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '基础设置',
      perm: 'settings_manage',
    },
  ].filter((m) => hasPermission(m.perm));

  const getSelectedKey = () => {
    return location.pathname || '/';
  };

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <Header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>爆肝电竞俱乐部</Title>
        <div style={{ display: 'flex', alignItems: 'center', color: 'white' }}>
          {user && (
            <>
              <span style={{ marginRight: 16 }}>
                {user.username} ({user.role === 'admin' ? '管理员' : '登记员'})
              </span>
              <Button 
                type="text" 
                icon={<LogoutOutlined />} 
                style={{ color: 'white' }} 
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </>
          )}
        </div>
      </Header>
      <Layout>
        <Sider className="app-sider" width={220} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => {
              console.log('菜单被点击，key:', key);
              navigate(key);
            }}
          />
        </Sider>
        <Content className="app-content" style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;