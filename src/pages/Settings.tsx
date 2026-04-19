import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Plus, Trash2, Edit, Save, X, Key, Check, Users } from 'lucide-react';
import { clsx } from 'clsx';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'employees' | 'industries'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // User Form State
  const [userForm, setUserForm] = useState({
    name: '',
    phone: '',
    email: '',
    designation: '',
    role: 'Employee',
    password: '',
    joiningDate: '',
    isActive: true
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Industry Form State
  const [newIndustry, setNewIndustry] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, indRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/users`),
        axios.get(`${import.meta.env.VITE_API_URL}/industries`)
      ]);
      setUsers(usersRes.data);
      setIndustries(indRes.data);
    } catch (err) {
      console.error('Failed to fetch settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/users/${editingUserId}`, userForm);
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/users`, userForm);
      }
      resetUserForm();
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving user');
    }
  };

  const editUser = (user: any) => {
    setEditingUserId(user._id);
    setUserForm({
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      designation: user.designation || '',
      role: user.role,
      password: '', // Don't show existing password
      joiningDate: user.joiningDate ? user.joiningDate.split('T')[0] : '',
      isActive: user.isActive
    });
    window.scrollTo(0, 0);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      name: '', phone: '', email: '', designation: '',
      role: 'Employee', password: '', joiningDate: '', isActive: true
    });
  };

  const handleIndustrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndustry.trim()) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/industries`, { name: newIndustry });
      setNewIndustry('');
      fetchData();
    } catch (err) {
      alert('Failed to add industry');
    }
  };

  const deleteIndustry = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/industries/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete industry');
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex border-b border-gray-200 mb-8">
        <button
          onClick={() => setActiveTab('employees')}
          className={clsx(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'employees' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center"><Users className="w-4 h-4 mr-2" /> Employee Management</div>
        </button>
        <button
          onClick={() => setActiveTab('industries')}
          className={clsx(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'industries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center"><Plus className="w-4 h-4 mr-2" /> Industry List</div>
        </button>
      </div>

      {activeTab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Form */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden sticky top-24">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingUserId ? 'Edit Employee' : 'Add New Employee'}
                </h3>
              </div>
              <form onSubmit={handleUserSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Phone (Login ID)</label>
                    <input type="tel" required value={userForm.phone} onChange={(e) => setUserForm({...userForm, phone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Designation</label>
                    <input type="text" value={userForm.designation} onChange={(e) => setUserForm({...userForm, designation: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Email</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">User Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Status</label>
                    <select value={userForm.isActive ? 'active' : 'inactive'} onChange={(e) => setUserForm({...userForm, isActive: e.target.value === 'active'})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">{editingUserId ? 'Change Password (Leave blank to keep current)' : 'Set Password'}</label>
                  <div className="relative mt-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" required={!editingUserId} value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="pl-10 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Joining Date</label>
                  <input type="date" value={userForm.joiningDate} onChange={(e) => setUserForm({...userForm, joiningDate: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-blue-700 transition-colors">
                    {editingUserId ? 'Update Employee' : 'Create Employee'}
                  </button>
                  {editingUserId && (
                    <button type="button" onClick={resetUserForm} className="bg-gray-100 text-gray-600 rounded-md py-2 px-4 text-sm font-semibold hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.map((user) => (
                  <li key={user._id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg",
                            user.role === 'Admin' || user.role === 'Owner' ? 'bg-purple-500' : 'bg-blue-500'
                          )}>
                            {user.name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-bold text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.phone} • {user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={clsx(
                            "px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider",
                            user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button onClick={() => editUser(user)} className="text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          <form onSubmit={handleIndustrySubmit} className="mb-8 flex gap-3">
            <input
              type="text"
              placeholder="Enter new industry name..."
              value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white rounded-md py-2 px-6 text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center">
              <Plus className="w-4 h-4 mr-2" /> Add
            </button>
          </form>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {industries.map((ind) => (
                <li key={ind._id} className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{ind.name}</span>
                  <button onClick={() => deleteIndustry(ind._id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
              {industries.length === 0 && <li className="px-4 py-8 text-center text-gray-500">No industries added yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
