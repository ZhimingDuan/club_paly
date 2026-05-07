import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Orders = lazy(() => import('@/pages/Orders'));
const Settlement = lazy(() => import('@/pages/Settlement'));
const Query = lazy(() => import('@/pages/Query'));
const Settings = lazy(() => import('@/pages/Settings'));

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
          const userInfo = await userApi.getCurrentUser();
          setUser(userInfo);
        } catch {
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
    return (
      <Layout>
        <Suspense fallback={<div style={{ padding: 24 }}>页面加载中...</div>}>
          {children}
        </Suspense>
      </Layout>
    );
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