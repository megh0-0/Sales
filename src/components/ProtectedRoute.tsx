import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: string[];
}

const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // Treat Admin and Owner as equivalent for roles list if either is present
    const hasAccess = roles.some(role => {
      if ((role === 'Admin' || role === 'Owner') && (user.role === 'Admin' || user.role === 'Owner')) return true;
      return role === user.role;
    });

    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
