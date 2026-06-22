import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// Пускает дальше только авторизованного пользователя.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="centered">Загрузка…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Пускает дальше только супер-админа.
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
