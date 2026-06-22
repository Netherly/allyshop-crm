export type Role = 'user' | 'super_admin';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: number;
  full_name: string;
  login: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CounterpartyType = 'client' | 'supplier' | 'both' | 'other';

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  np_branch: string | null;
  counterparty_type: CounterpartyType;
  client_type: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SetComponent {
  id: number;
  set_id: number;
  product_id: number;
  quantity: number;
  product?: { id: number; name: string; article: string | null; size: string | null };
}

export interface ProductSet {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  items_count?: number;
  availability?: number;
  set_items?: SetComponent[];
  created_at: string;
  updated_at: string;
}

export interface OrderLine {
  id: number;
  item_type: 'product' | 'set';
  product_id: number | null;
  set_id: number | null;
  name: string;
  article: string | null;
  size: string | null;
  quantity: number;
  price: string;
  total: string;
  cost_price: string;
  components: { id: number; product_id: number; quantity: number; product?: { name: string; size: string | null } }[];
}

export interface OrderDelivery {
  id: number;
  order_id: number;
  recipient_name: string | null;
  recipient_phone: string | null;
  city: string | null;
  branch: string | null;
  ttn: string | null;
  delivery_payer: string | null;
  delivery_cost: string;
  delivery_status: string | null;
  np_raw_status: string | null;
}

export interface Order {
  id: number;
  order_number: string;
  source: string | null;
  order_type: string;
  order_date: string;
  status: string;
  payment_status: string;
  tags: string | null;
  client_id: number | null;
  total_amount: string;
  discount_amount: string;
  discount_percent: string;
  paid_amount: string;
  comment: string | null;
  stock_written_off: boolean;
  stock_returned: boolean;
  created_at: string;
  client?: Client | null;
  manager?: { id: number; full_name: string };
  order_items: OrderLine[];
  finance_transactions?: FinanceTransaction[];
  delivery?: OrderDelivery | null;
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  entity_type: string;
  entity_id: number;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  user?: { full_name: string };
}

export interface FinanceTransaction {
  id: number;
  date_time: string;
  order_id: number | null;
  order_number: string | null;
  payment_type: string;
  amount: string;
  comment: string | null;
  status: string;
  created_at: string;
  user?: { full_name: string };
}

export interface OrderListItem {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  payment_status: string;
  total_amount: string;
  created_at: string;
  items_count: number;
  client?: { name: string } | null;
  manager?: { full_name: string };
}

export interface StockMovement {
  id: number;
  movement_date: string;
  movement_type: string;
  product_id: number | null;
  set_id: number | null;
  quantity: number;
  price: string;
  total: string;
  counterparty_id: number | null;
  order_id: number | null;
  description: string | null;
  product: { name: string; article: string | null; size: string | null } | null;
  set: { name: string } | null;
  user: { full_name: string } | null;
  counterparty: { name: string } | null;
}

export interface Product {
  id: number;
  name: string;
  article: string | null;
  barcode: string | null;
  color: string | null;
  model: string | null;
  size: string | null;
  comment: string | null;
  photo_url: string | null;
  // денежные поля приходят строками (Prisma Decimal)
  cost_price: string;
  wholesale_price: string;
  retail_price: string;
  is_active: boolean;
  stock: number;
  created_at: string;
  updated_at: string;
}
