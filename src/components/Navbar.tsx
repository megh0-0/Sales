import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Database, BarChart3, Settings, LogOut, User, PlusCircle, Share2 } from 'lucide-react';
import { clsx } from 'clsx';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/entry', label: 'Entry', icon: PlusCircle },
    { to: '/data-bank', label: 'Data Bank', icon: Database },
    { to: '/shared-data', label: 'Shared', icon: Share2 },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ];

  if (user?.role === 'Admin' || user?.role === 'Owner') {
    navLinks.push({ to: '/settings', label: 'Settings', icon: Settings });
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">SalesPro</span>
            </Link>
            <div className="hidden md:flex space-x-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    clsx(
                      'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <link.icon className="w-4 h-4 mr-2" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <User className="w-4 h-4 text-gray-500" />
              <div className="flex flex-col">
                <span className="font-semibold leading-none">{user?.name}</span>
                <span className="text-xs text-gray-500 mt-1">{user?.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-around border-t border-gray-100 py-2">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center px-2 py-1 text-xs font-medium rounded-md',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )
            }
          >
            <link.icon className="w-5 h-5 mb-1" />
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
