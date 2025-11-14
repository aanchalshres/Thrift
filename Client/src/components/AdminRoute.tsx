import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, loading, user } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const apiBase = import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';

  useEffect(() => {
    if (loading) return;
    if (!token) { setIsAdmin(false); return; }
    // If we already have role on user, use it
    if (user && user.role) {
      setIsAdmin(String(user.role).toLowerCase() === 'admin');
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        const role = data?.user?.role || 'buyer';
        if (mounted) setIsAdmin(String(role).toLowerCase() === 'admin');
      } catch {
        if (mounted) setIsAdmin(false);
      }
    })();
    return () => { mounted = false; };
  }, [token, loading, user, apiBase]);

  if (loading || isAdmin === null) return null; // could show a spinner

  if (!token || !isAdmin) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
