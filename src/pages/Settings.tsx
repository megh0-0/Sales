import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Plus, Trash2, Edit, Save, X, Key, Check, Users, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'employees' | 'industries'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  
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
    setBtnLoading(true);
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
    } finally {
      setBtnLoading(false);
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
    
    setBtnLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/industries`, { name: newIndustry.trim() });
      setNewIndustry('');
      // Manually update list or refetch
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/industries`);
      setIndustries(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add industry');
    } finally {
      setBtnLoading(false);
    }
  };

  const deleteIndustry = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/industries/${id}`);
      setIndustries(prev => prev.filter(i => i._id !== id));
    } catch (err) {
      alert('Failed to delete industry');
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 px-2 sm:px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('employees')}
          className={clsx(
            'px-4 sm:px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'employees' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center"><Users className="w-4 h-4 mr-2" /> Employees</div>
        </button>
        <button
          onClick={() => setActiveTab('industries')}
          className={clsx(
            'px-4 sm:px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'industries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center"><Plus className="w-4 h-4 mr-2" /> Industries</div>
        </button>
      </div>

      {activeTab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Form */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden sticky top-24">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  {editingUserId ? 'Edit Employee' : 'Add New Employee'}
                </h3>
              </div>
              <form onSubmit={handleUserSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone (ID)</label>
                    <input type="tel" required value={userForm.phone} onChange={(e) => setUserForm({...userForm, phone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Designation</label>
                    <input type="text" value={userForm.designation} onChange={(e) => setUserForm({...userForm, designation: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</label>
                    <select value={userForm.isActive ? 'active' : 'inactive'} onChange={(e) => setUserForm({...userForm, isActive: e.target.value === 'active'})} className="mt-1 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{editingUserId ? 'Change Password' : 'Set Password'}</label>
                  <div className="relative mt-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" placeholder={editingUserId ? "Leave blank to keep" : "••••••••"} required={!editingUserId} value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="pl-10 block w-full border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button type="submit" disabled={btnLoading} className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center">
                    {btnLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (editingUserId ? 'Update Profile' : 'Create Account')}
                  </button>
                  {editingUserId && (
                    <button type="button" onClick={resetUserForm} className="bg-gray-100 text-gray-600 rounded-xl py-3 px-6 text-sm font-bold hover:bg-gray-200 transition-all">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {users.map((u) => (
                  <li key={u._id} className="px-6 py-5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className={clsx(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm",
                          u.role === 'Admin' || u.role === 'Owner' ? 'bg-indigo-500' : 'bg-blue-500'
                        )}>
                          {u.name.charAt(0)}
                        </div>
                        <div className="ml-4 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{u.phone} • {u.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <span className={clsx(
                          "px-3 py-1 text-[9px] font-extrabold uppercase rounded-full tracking-widest",
                          u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={() => editUser(u)} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </li>
                ))}
                {users.length === 0 && <li className="px-6 py-12 text-center text-gray-400 italic">No employees found.</li>}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          <form onSubmit={handleIndustrySubmit} className="mb-8 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="E.g. Real Estate, Tech, HVAC..."
              value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl py-3 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
            />
            <button type="submit" disabled={btnLoading} className="bg-blue-600 text-white rounded-xl py-3 px-8 text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-100 disabled:opacity-50">
              {btnLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <><Plus className="w-4 h-4 mr-2" /> Add Category</>}
            </button>
          </form>

          <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Configured Industries
            </div>
            <ul className="divide-y divide-gray-100">
              {industries.map((ind) => (
                <li key={ind._id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <span className="text-sm font-bold text-gray-900">{ind.name}</span>
                  <button onClick={() => deleteIndustry(ind._id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
              {industries.length === 0 && <li className="px-6 py-12 text-center text-gray-400 italic">No categories added yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
