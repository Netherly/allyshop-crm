import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// Разделы меню. perm — нужный доступ (или список: достаточно любого); superAdmin — только админ.
interface NavItem {
  to: string;
  label: string;
  perm?: string | string[];
  superAdmin?: boolean;
}
const navItems: NavItem[] = [
  { to: '/', label: 'Дашборд', perm: 'dashboard.view' },
  { to: '/orders', label: 'Заказы', perm: 'orders.view' },
  { to: '/warehouse', label: 'Склад', perm: ['products.view', 'sets.view', 'stock.view', 'barcodes.print'] },
  { to: '/clients', label: 'Клиенты', perm: 'clients.view' },
  { to: '/finance', label: 'Финансы', perm: 'finance.view' },
  { to: '/audit', label: 'История', perm: 'audit.view' },
  { to: '/users', label: 'Пользователи', superAdmin: true },
  { to: '/access', label: 'Доступы', superAdmin: true },
];

// Иконка выхода (дверь со стрелкой).
function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const items = navItems.filter((item) => {
    if (item.superAdmin) return user?.role === 'super_admin';
    if (!item.perm) return true;
    const perms = Array.isArray(item.perm) ? item.perm : [item.perm];
    return perms.some((p) => hasPermission(p));
  });

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">allyshop CRM</div>
        <nav className="sidebar__nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__user">
          <span className="sidebar__username" title={user?.full_name}>
            {user?.full_name}
          </span>
          <button className="sidebar__logout" onClick={logout} title="Выйти" aria-label="Выйти">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className="content">
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
