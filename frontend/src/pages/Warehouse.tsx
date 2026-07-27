import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// Подразделы склада переключаются табами, у каждого свой URL и свой доступ.
const tabs = [
  { to: 'products', label: 'Товары', perm: 'products.view' },
  { to: 'sets', label: 'Наборы', perm: 'sets.view' },
  { to: 'movements', label: 'Приход / расход', perm: 'stock.view' },
  { to: 'barcodes', label: 'Печать штрих-кодов', perm: 'barcodes.print' },
];

export function Warehouse() {
  const { hasPermission } = useAuth();
  const visible = tabs.filter((t) => hasPermission(t.perm));

  return (
    <div className="warehouse-page">
      <h1 className="page-title">Склад</h1>
      <div className="tabs">
        {visible.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => (isActive ? 'tab tab--active' : 'tab')}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="warehouse-body">
        <Outlet />
      </div>
    </div>
  );
}
