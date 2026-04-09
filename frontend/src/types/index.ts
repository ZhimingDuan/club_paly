// 用户相关类型
export enum RoleEnum {
  ADMIN = 'admin',
  CLERK = 'clerk'
}

export interface User {
  id: number;
  username: string;
  role: RoleEnum;
  is_active: boolean;
  permissions?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

// 打手表相关类型
export interface Worker {
  id: number;
  name: string;
  commission_rate: number;
}

// 物资表相关类型
export interface Item {
  id: number;
  item_name: string;
  unit_qty: number;
  unit_price: number;
  is_commissioned: boolean;
}

// 订单状态枚举
export enum OrderStatusEnum {
  PENDING = 'pending',
  COMPLETED = 'completed'
}

// 订单物资副表相关类型
export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  target_qty: number;
  premium_rate: number;
  item: Item;
  delivered_qty?: number;
}

// 订单主表相关类型
export interface Order {
  id: number;
  boss_name: string;
  worker_id: number | null;
  remarks: string | null;
  status: OrderStatusEnum;
  create_time: string;
  worker: Worker | null;
  order_items: OrderItem[];
}

// 结算物资副表相关类型
export interface SettlementItem {
  id: number;
  settlement_id: number;
  item_id: number;
  submit_qty: number;
  total_value: number;
  club_cut: number;
  worker_pay: number;
  item: Item;
}

// 结算主表相关类型
export interface Settlement {
  id: number;
  order_id: number;
  worker_id: number;
  datetime: string;
  order: Order;
  worker: Worker;
  settlement_items: SettlementItem[];
}

// 报表相关类型
export interface ReportParams {
  start_date: string;
  end_date: string;
}

export interface ReportSummary {
  start_date: string;
  end_date: string;
  total_income: number;
  total_expense: number;
  net_profit: number;
}