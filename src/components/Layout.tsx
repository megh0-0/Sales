import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 sm:p-8 mt-16 md:mt-0 mb-20 md:mb-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
