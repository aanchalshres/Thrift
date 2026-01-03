import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth();
  const location = useLocation();
  try { console.log('[ProtectedRoute]', { loading, hasToken: !!token, path: location.pathname }); } catch {}

  // Wait for hydration on refresh
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-700">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-600 border-t-transparent animate-spin" />
          <span>Authenticating…</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};