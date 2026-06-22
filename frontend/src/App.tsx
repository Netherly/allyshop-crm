import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { Users } from '@/pages/Users';
import { Warehouse } from '@/pages/Warehouse';
import { Products } from '@/pages/Products';
import { Sets } from '@/pages/Sets';
import { Movements } from '@/pages/Movements';
import { Clients } from '@/pages/Clients';
import { Orders } from '@/pages/Orders';
import { OrderCard } from '@/pages/OrderCard';
import { Finance } from '@/pages/Finance';
import { AuditLog } from '@/pages/AuditLog';
import { ProtectedRoute, RequireSuperAdmin } from '@/components/ProtectedRoute';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="warehouse" element={<Warehouse />}>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<Products />} />
          <Route path="sets" element={<Sets />} />
          <Route path="movements" element={<Movements />} />
        </Route>
        <Route path="clients" element={<Clients />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderCard />} />
        <Route path="orders/:id" element={<OrderCard />} />
        <Route path="finance" element={<Finance />} />
        <Route
          path="audit"
          element={
            <RequireSuperAdmin>
              <AuditLog />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireSuperAdmin>
              <Users />
            </RequireSuperAdmin>
          }
        />
      </Route>
    </Routes>
  );
}
