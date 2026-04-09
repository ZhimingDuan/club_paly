import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Typography, Drawer, Grid } from 'antd';
import {
  LogoutOutlined,
  HomeOutlined,
  OrderedListOutlined,
  DollarOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  UserOutlined,
  MenuOutlined,
} from '@ant-design/icons';
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
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      icon: <HomeOutlined className="menu-ico" />,
      label: '俱乐部收益',
      perm: 'dashboard_view',
    },
    {
      key: '/orders',
      icon: <OrderedListOutlined className="menu-ico" />,
      label: '订单管理',
      perm: 'orders_manage',
    },
    {
      key: '/settlement',
      icon: <DollarOutlined className="menu-ico" />,
      label: '打手结算',
      perm: 'settlement_manage',
    },
    {
      key: '/query',
      icon: <SearchOutlined className="menu-ico" />,
      label: '明细查询',
      perm: 'query_view',
    },
    {
      key: '/settings',
      icon: <SettingOutlined className="menu-ico" />,
      label: '基础设置',
      perm: 'settings_manage',
    },
  ].filter((m) => hasPermission(m.perm));

  const getSelectedKey = () => {
    return location.pathname || '/';
  };

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) setMobileMenuOpen(false);
  };

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <Header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isMobile ? (
          <Button
            className="header-menu-btn"
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
          />
        ) : null}
        <div className="brand-wrap">
          <div className="brand-logo">
            <ThunderboltOutlined />
          </div>
          <Title level={isMobile ? 5 : 4} style={{ color: 'white', margin: 0 }}>爆肝电竞俱乐部</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', color: 'white' }}>
          {user && (
            <>
              {!isMobile ? (
                <span className="user-chip" style={{ marginRight: 16 }}>
                  {user.role === 'admin' ? <CrownOutlined /> : <UserOutlined />}
                  <span>{user.username} ({user.role === 'admin' ? '管理员' : '登记员'})</span>
                </span>
              ) : null}
              <Button 
                className="header-logout-btn"
                type="text" 
                icon={<LogoutOutlined />} 
                style={{ color: 'white' }} 
                onClick={handleLogout}
              >
                {!isMobile ? '退出登录' : ''}
              </Button>
            </>
          )}
        </div>
      </Header>
      <Layout>
        {!isMobile ? (
          <Sider className="app-sider" width={220} style={{ background: '#fff' }}>
            <Menu
              mode="inline"
              selectedKeys={[getSelectedKey()]}
              style={{ height: '100%', borderRight: 0 }}
              items={menuItems}
              onClick={({ key }) => {
                console.log('菜单被点击，key:', key);
                handleMenuClick(key);
              }}
            />
          </Sider>
        ) : null}
        <Content className="app-content" style={{ margin: isMobile ? '12px 8px' : '24px 16px', padding: isMobile ? 12 : 24, background: '#fff', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>

      <Drawer
        title="导航菜单"
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width={250}
        bodyStyle={{ padding: 8 }}
      >
        {user ? (
          <div className="mobile-user-row">
            <span className="user-chip">
                {user.role === 'admin' ? <CrownOutlined /> : <UserOutlined />}
                <span>{user.username} ({user.role === 'admin' ? '管理员' : '登记员'})</span>
              </span>
            <Button size="small" onClick={handleLogout} icon={<LogoutOutlined />}>退出</Button>
          </div>
        ) : null}
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Drawer>
    </Layout>
  );
};

export default AppLayout;