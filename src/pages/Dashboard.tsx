import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, BarChart3, Settings, PlusCircle, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'New Entry',
      description: 'Add a new lead and extract data from visiting cards',
      icon: PlusCircle,
      path: '/entry',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Data Bank',
      description: 'View, search, and manage all your collected leads',
      icon: Database,
      path: '/data-bank',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Shared Data',
      description: 'Access leads shared with you by your team members',
      icon: Share2,
      path: '/shared-data',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      title: 'Reports',
      description: 'Analyze lead trends with daily and monthly charts',
      icon: BarChart3,
      path: '/reports',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  if (user?.role === 'Admin' || user?.role === 'Owner') {
    menuItems.push({
      title: 'Settings',
      description: 'Manage employees, roles, and industry categories',
      icon: Settings,
      path: '/settings',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Welcome back, {user?.name}!
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          What would you like to do today?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-start space-x-4 text-left"
          >
            <div className={clsx("flex-shrink-0 p-3 rounded-lg", item.bgColor)}>
              <item.icon className={clsx("h-8 w-8", item.color)} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 bg-blue-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-2">Quick Tip</h2>
          <p className="text-blue-100 text-sm max-w-md">
            You can use the camera to take a photo of a business card. Our AI will automatically extract the name, company, and phone numbers for you!
          </p>
        </div>
        <PlusCircle className="absolute -right-8 -bottom-8 h-40 w-40 text-blue-500 opacity-20 rotate-12" />
      </div>
    </div>
  );
};

export default Dashboard;
