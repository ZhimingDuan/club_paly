import { create } from 'zustand';
import { User, RoleEnum, Worker, Item, Order, Settlement } from '@/types';

interface StoreState {
  // 用户状态
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  
  // 打手表数据
  workers: Worker[];
  setWorkers: (workers: Worker[]) => void;
  
  // 物资表数据
  items: Item[];
  setItems: (items: Item[]) => void;
  
  // 订单数据
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  
  // 结算数据
  settlements: Settlement[];
  setSettlements: (settlements: Settlement[]) => void;
}

export const useStore = create<StoreState>((set) => ({
  // 用户状态
  user: null,
  token: localStorage.getItem('token'),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  
  // 打手表数据
  workers: [],
  setWorkers: (workers) => set({ workers }),
  
  // 物资表数据
  items: [],
  setItems: (items) => set({ items }),
  
  // 订单数据
  orders: [],
  setOrders: (orders) => set({ orders }),
  
  // 结算数据
  settlements: [],
  setSettlements: (settlements) => set({ settlements }),
}));

// 权限检查辅助函数
export const usePermission = () => {
  const { user } = useStore();
  
  const isAdmin = user?.role === RoleEnum.ADMIN;
  const isClerk = user?.role === RoleEnum.CLERK;
  const permissionSet = new Set(
    (user?.permissions || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  );
  const hasPermission = (key: string) => isAdmin || permissionSet.has(key);
  
  return {
    isAdmin,
    isClerk,
    hasPermission,
    hasDeletePermission: hasPermission('delete_action'),
  };
};