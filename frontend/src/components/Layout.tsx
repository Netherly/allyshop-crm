import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// Разделы меню. Поле superAdmin — пункт виден только супер-админу.
const navItems = [
  { to: '/', label: 'Рабочий стол' },
  { to: '/warehouse', label: 'Склад' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/orders', label: 'Заказы' },
  { to: '/finance', label: 'Финансы' },
  { to: '/audit', label: 'История', superAdmin: true },
  { to: '/users', label: 'Пользователи', superAdmin: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const items = navItems.filter((item) => !item.superAdmin || user?.role === 'super_admin');

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
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="topbar__user">
            <span className="topbar__name">{user?.full_name}</span>
            <button className="btn btn--sm" onClick={logout}>
              Выйти
            </button>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
