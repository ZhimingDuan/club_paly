import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Settlement from '@/pages/Settlement';
import Query from '@/pages/Query';
import Settings from '@/pages/Settings';

const App: React.FC = () => {
  const { token, setUser, user } = useStore();
  const permissionSet = new Set(
    (user?.permissions || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  );
  const hasPermission = (key: string) => user?.role === 'admin' || permissionSet.has(key);

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          console.log('开始检查用户认证状态');
          const userInfo = await userApi.getCurrentUser();
          console.log('认证成功，用户信息:', userInfo);
          setUser(userInfo);
        } catch (error) {
          console.error('认证失败', error);
          // 清除无效的token
          useStore.getState().logout();
        }
      }
    };

    checkAuth();
  }, [token, setUser]);

  // 保护路由组件
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!token) {
      return <Navigate to="/login" />;
    }
    return <Layout>{children}</Layout>;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              {hasPermission('dashboard_view') ? <Dashboard /> : <Navigate to="/orders" />}
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/orders" 
          element={
            <ProtectedRoute>
              {hasPermission('orders_manage') ? <Orders /> : <Navigate to="/" />}
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settlement" 
          element={
            <ProtectedRoute>
              {hasPermission('settlement_manage') ? <Settlement /> : <Navigate to="/" />}
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/query" 
          element={
            <ProtectedRoute>
              {hasPermission('query_view') ? <Query /> : <Navigate to="/" />}
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              {hasPermission('settings_manage') ? <Settings /> : <Navigate to="/" />}
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;