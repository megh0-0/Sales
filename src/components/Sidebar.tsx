import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, PlusCircle, Database, Share2, BarChart3, 
  Contact, FileText, Settings, LogOut, ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/entry', label: 'Entry', icon: PlusCircle },
    { to: '/data-bank', label: 'Data Bank', icon: Database },
    { to: '/shared-leads', label: 'Shared', icon: Share2 },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/my-card', label: 'My Card', icon: Contact },
    { to: '/documents', label: 'Docs', icon: FileText },
  ];

  if (user?.role === 'Admin' || user?.role === 'Owner') {
    navLinks.push({ to: '/settings', label: 'Settings', icon: Settings });
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 flex-col z-[100] overflow-hidden">
        <div className="p-8 pb-12">
          <img src="/company_logo.png" alt="THE AIRCONS LTD." className="w-full h-auto object-contain" />
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group',
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                )
              }
            >
              <link.icon className={clsx("w-5 h-5 mr-4", location.pathname === link.to ? "text-white" : "text-gray-300 group-hover:text-gray-400")} />
              <span className="tracking-tight">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{user?.role}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl transition-colors font-bold text-xs"
          >
            <LogOut className="w-5 h-5 mr-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-50">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-gray-50 rounded-xl text-gray-500 active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all active:scale-95 max-w-[200px] bg-gray-50">
            <div className="text-right min-w-0">
              <p className="text-[10px] font-black text-gray-900 leading-tight uppercase truncate">{user?.name}</p>
              <p className="text-[8px] font-bold text-blue-600 uppercase tracking-tighter">{user?.role}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs uppercase flex-shrink-0">
              {user?.name?.charAt(0)}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2 flex items-center overflow-x-auto no-scrollbar z-50 px-2 gap-4">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center flex-shrink-0 min-w-[70px] py-1 text-[9px] font-bold uppercase tracking-wider transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-400'
              )
            }
          >
            <link.icon className="w-6 h-6 mb-1" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
};

export default Sidebar;
