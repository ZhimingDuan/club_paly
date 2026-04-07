import axios from 'axios';
import { User, Token, Worker, Item, Order, Settlement, ReportParams, ReportSummary } from '@/types';
import { useStore } from '@/store/useStore';

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器，添加token
api.interceptors.request.use(
  (config) => {
    const token = useStore.getState().token;
    console.log('请求URL:', config.url);
    console.log('请求Token:', token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('已添加Authorization头');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器，处理错误
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 未授权，清除token并跳转到登录页
      useStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authApi = {
  login: async (username: string, password: string): Promise<Token> => {
    return api.post('/auth/login', { username, password });
  },
  initAdmin: async (): Promise<{ message: string }> => {
    return api.post('/auth/init-admin');
  },
};

// 用户相关API
export const userApi = {
  getCurrentUser: async (): Promise<User> => {
    return api.get('/users/me');
  },
  getUsers: async (): Promise<User[]> => {
    return api.get('/users/');
  },
  createUser: async (user: { username: string; password: string; role: string; permissions?: string }): Promise<User> => {
    return api.post('/users/', user);
  },
  updateUser: async (id: number, user: { username?: string; password?: string; role?: string; is_active?: boolean; permissions?: string }): Promise<User> => {
    return api.put(`/users/${id}`, user);
  },
  deleteUser: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/users/${id}`);
  },
};

// 打手表相关API
export const workerApi = {
  getWorkers: async (): Promise<Worker[]> => {
    return api.get('/workers/');
  },
  createWorker: async (worker: { name: string; commission_rate: number }): Promise<Worker> => {
    return api.post('/workers/', worker);
  },
  updateWorker: async (id: number, worker: { name?: string; commission_rate?: number }): Promise<Worker> => {
    return api.put(`/workers/${id}`, worker);
  },
  deleteWorker: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/workers/${id}`);
  },
};

// 物资表相关API
export const itemApi = {
  getItems: async (): Promise<Item[]> => {
    return api.get('/items/');
  },
  createItem: async (item: { item_name: string; unit_qty: number; unit_price: number }): Promise<Item> => {
    return api.post('/items/', item);
  },
  updateItem: async (id: number, item: { item_name?: string; unit_qty?: number; unit_price?: number }): Promise<Item> => {
    return api.put(`/items/${id}`, item);
  },
  deleteItem: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/items/${id}`);
  },
};

// 订单相关API
export const orderApi = {
  getOrders: async (): Promise<Order[]> => {
    return api.get('/orders/');
  },
  createOrder: async (order: {
    boss_name: string;
    worker_id?: number | null;
    remarks: string | null;
    order_items: Array<{
      item_id: number;
      target_qty: number;
      premium_rate: number;
    }>;
  }): Promise<Order> => {
    return api.post('/orders/', order);
  },
  updateOrder: async (id: number, order: {
    boss_name?: string;
    worker_id?: number | null;
    remarks?: string | null;
    status?: string;
  }): Promise<Order> => {
    return api.put(`/orders/${id}`, order);
  },
  deleteOrder: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/orders/${id}`);
  },
  getPendingOrders: async (): Promise<Order[]> => {
    return api.get('/orders/pending/list');
  },
  forceComplete: async (id: number): Promise<Order> => {
    return api.post(`/orders/${id}/force-complete`);
  },
};

// 结算相关API
export const settlementApi = {
  getSettlements: async (): Promise<Settlement[]> => {
    return api.get('/settlements/');
  },
  createSettlement: async (settlement: {
    order_id: number;
    worker_id: number;
    settlement_items: Array<{
      item_id: number;
      submit_qty: number;
    }>;
  }): Promise<Settlement> => {
    return api.post('/settlements/', settlement);
  },
  deleteSettlement: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/settlements/${id}`);
  },
};

// 报表相关API
export const reportApi = {
  exportExcel: async (params: ReportParams): Promise<Blob> => {
    // 使用与其它接口相同的 axios 实例，确保 baseURL 与拦截器一致
    return api.post('/reports/export-excel', params, { responseType: 'blob' });
  },
  getSummary: async (params: ReportParams): Promise<ReportSummary> => {
    return api.post('/reports/summary', params);
  },
  getTrend: async (params: ReportParams): Promise<Array<{date: string, income: number, expense: number, profit: number}>> => {
    return api.post('/reports/trend', params);
  },
};