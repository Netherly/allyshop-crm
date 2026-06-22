import { NavLink, Outlet } from 'react-router-dom';

// Подразделы склада переключаются табами, у каждого свой URL.
const tabs = [
  { to: 'products', label: 'Товары' },
  { to: 'sets', label: 'Наборы' },
  { to: 'movements', label: 'Приход/уход' },
];

export function Warehouse() {
  return (
    <div className="warehouse-page">
      <h1 className="page-title">Склад</h1>
      <div className="tabs">
        {tabs.map((t) => (
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
