import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, Trash2, Edit3, Key, 
  Users, Loader2, Zap, ArrowLeft, Target, Calendar, User as UserIcon, Camera
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'employees' | 'industries' | 'supplements'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  
  const [userForm, setUserForm] = useState<any>({
    name: '',
    phone: '',
    email: '',
    designation: '',
    role: 'Employee',
    password: '',
    joiningDate: '',
    resignationDate: '',
    monthlyTarget: 0,
    isActive: true,
    managers: []
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [visitingCardFile, setVisitingCardFile] = useState<File | null>(null);

  const [newIndustry, setNewIndustry] = useState('');
  const [supplements, setSupplements] = useState<any[]>([]);
  const [newSupplementName, setNewSupplementName] = useState('');
  const [supplementFile, setSupplementFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, indRes, supRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/users`),
        axios.get(`${import.meta.env.VITE_API_URL}/industries`),
        axios.get(`${import.meta.env.VITE_API_URL}/supplements`)
      ]);
      setUsers(usersRes.data || []);
      setIndustries(indRes.data || []);
      setSupplements(supRes.data || []);
    } catch (err) {
      console.error('Failed to fetch settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    
    const formData = new FormData();
    Object.keys(userForm).forEach(key => {
      if (key === 'managers') {
        formData.append(key, JSON.stringify(userForm[key] || []));
      } else if (userForm[key] !== null && userForm[key] !== undefined) {
        formData.append(key, userForm[key]);
      }
    });
    
    if (visitingCardFile) {
      formData.append('visitingCard', visitingCardFile);
    }

    try {
      if (editingUserId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/users/${editingUserId}`, formData);
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/users`, formData);
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
    if (!user) return;
    setEditingUserId(user._id);
    setUserForm({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      designation: user.designation || '',
      role: user.role || 'Employee',
      password: '',
      joiningDate: user.joiningDate ? user.joiningDate.split('T')[0] : '',
      resignationDate: user.resignationDate ? user.resignationDate.split('T')[0] : '',
      monthlyTarget: user.monthlyTarget || 0,
      isActive: user.isActive !== undefined ? user.isActive : true,
      managers: user.managers?.map((m: any) => typeof m === 'object' ? m?._id : m).filter(Boolean) || []
    });
    setVisitingCardFile(null);
    window.scrollTo(0, 0);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      name: '', phone: '', email: '', designation: '',
      role: 'Employee', password: '', joiningDate: '', resignationDate: '',
      monthlyTarget: 0, isActive: true, managers: []
    });
    setVisitingCardFile(null);
  };

  const handleAddIndustry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndustry.trim()) return;
    setBtnLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/industries`, { name: newIndustry.trim() });
      setNewIndustry('');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/industries`);
      setIndustries(res.data || []);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add industry');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDeleteIndustry = async (id: string) => {
    if (!window.confirm('Delete this industry category?')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/industries/${id}`);
      setIndustries(prev => prev.filter(ind => ind._id !== id));
    } catch (err) {
      alert('Failed to delete industry');
    }
  };

  const handleAddSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplementFile) return;
    setBtnLoading(true);
    const formData = new FormData();
    formData.append('name', newSupplementName || supplementFile.name);
    formData.append('file', supplementFile);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/supplements`, formData);
      setNewSupplementName('');
      setSupplementFile(null);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/supplements`);
      setSupplements(res.data || []);
    } catch (err) {
      alert('Failed to upload supplement');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDeleteSupplement = async (id: string) => {
    if (!window.confirm('Delete this supplement document?')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/supplements/${id}`);
      setSupplements(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      alert('Failed to delete supplement');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-gray-100 mb-10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('employees')}
          className={clsx(
            'flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap',
            activeTab === 'employees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          )}
        >
          <Users className="w-4 h-4" /> Employees
        </button>
        <button
          onClick={() => setActiveTab('industries')}
          className={clsx(
            'flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap',
            activeTab === 'industries' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          )}
        >
          <Plus className="w-4 h-4" /> Industries
        </button>
        <button
          onClick={() => setActiveTab('supplements')}
          className={clsx(
            'flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap',
            activeTab === 'supplements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          )}
        >
          <Zap className="w-4 h-4" /> Supplements
        </button>
      </div>

      {activeTab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Add Employee Form */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{editingUserId ? 'Update Profile' : 'Add New Employee'}</h3>
            <form onSubmit={handleUserSubmit} className="space-y-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone (ID)</label>
                    <input type="tel" required value={userForm.phone} onChange={(e) => setUserForm({...userForm, phone: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Designation</label>
                    <input type="text" value={userForm.designation} onChange={(e) => setUserForm({...userForm, designation: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monthly Target (BDT)</label>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input type="number" value={userForm.monthlyTarget} onChange={(e) => setUserForm({...userForm, monthlyTarget: Number(e.target.value)})} className="w-full pl-10 bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                    <select value={userForm.isActive ? 'active' : 'inactive'} onChange={(e) => setUserForm({...userForm, isActive: e.target.value === 'active'})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Joining Date</label>
                    <input type="date" value={userForm.joiningDate} onChange={(e) => setUserForm({...userForm, joiningDate: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Resignation Date</label>
                    <input type="date" value={userForm.resignationDate} onChange={(e) => setUserForm({...userForm, resignationDate: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
               </div>

               <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assign Managers</label>
                  <select 
                    multiple
                    value={userForm.managers || []}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setUserForm({...userForm, managers: values});
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none h-32"
                  >
                    {users.filter(u => u && u._id !== editingUserId && ['Manager', 'Admin', 'Owner'].includes(u.role)).map(u => (
                      <option key={u._id} value={u._id} className="p-2 border-b border-gray-50">{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <p className="text-[8px] font-bold text-gray-400 uppercase ml-1 mt-1 mt-1">Hold Ctrl (Cmd) to select multiple managers.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Set Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input type="password" required={!editingUserId} value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="w-full pl-10 bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Visiting Card</label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                       <Camera className="w-4 h-4 text-gray-400" />
                       <span className="text-[10px] font-bold text-gray-500 uppercase truncate">
                          {visitingCardFile ? visitingCardFile.name : 'Upload Card'}
                       </span>
                       <input type="file" className="hidden" onChange={(e) => setVisitingCardFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
               </div>

               <div className="flex gap-4">
                  <button type="submit" disabled={btnLoading} className="flex-1 bg-blue-600 text-white rounded-2xl py-4 text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                    {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editingUserId ? 'Update Profile' : 'Create Account')}
                  </button>
                  {editingUserId && (
                    <button type="button" onClick={resetUserForm} className="px-8 bg-gray-100 text-gray-500 rounded-2xl py-4 text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                      Cancel
                    </button>
                  )}
               </div>
            </form>
          </div>

          {/* Employee List */}
          <div className="space-y-4">
             {users.map((u) => u && (
                <div key={u._id} className="bg-white p-5 rounded-3xl border border-gray-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-50 overflow-hidden">
                        {u.visitingCard ? <img src={u.visitingCard} className="w-full h-full object-cover" /> : (u.name ? u.name.charAt(0) : '?')}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 leading-none mb-1 uppercase tracking-tight">{u.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.phone} • {u.role}</p>
                        <p className="text-[9px] font-black text-blue-600 uppercase mt-0.5">Target: ৳{u.monthlyTarget?.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <span className={clsx(
                        "px-3 py-1 text-[8px] font-black uppercase rounded-full tracking-widest",
                        u.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => editUser(u)} className="p-2 text-gray-300 hover:text-blue-600 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             ))}
          </div>
        </div>
      ) : activeTab === 'industries' ? (
        <div className="max-w-2xl space-y-8">
           <form onSubmit={handleAddIndustry} className="flex gap-4">
              <input 
                type="text" 
                value={newIndustry} 
                onChange={(e) => setNewIndustry(e.target.value)} 
                placeholder="Industry name..." 
                className="flex-1 bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" 
              />
              <button 
                type="submit"
                disabled={btnLoading}
                className="bg-blue-600 text-white px-8 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {btnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Category'}
              </button>
           </form>
           <div className="bg-white rounded-[2rem] border border-gray-50 shadow-sm overflow-hidden">
              <div className="p-6 bg-gray-50 border-b border-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest">Configured Industries</div>
              <div className="divide-y divide-gray-50">
                 {industries.map(ind => ind && (
                    <div key={ind._id} className="p-5 px-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors font-black text-sm text-gray-900 uppercase tracking-tight">
                       {ind.name}
                       <button 
                        onClick={() => handleDeleteIndustry(ind._id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      ) : (
        <div className="max-w-4xl space-y-8">
           <form onSubmit={handleAddSupplement} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Upload New Document</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Document Name</label>
                    <input 
                      type="text" 
                      value={newSupplementName} 
                      onChange={(e) => setNewSupplementName(e.target.value)} 
                      placeholder="e.g. Profile 2026"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select File</label>
                    <input 
                      type="file" 
                      onChange={(e) => setSupplementFile(e.target.files?.[0] || null)} 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                 </div>
              </div>
              <button 
                type="submit"
                disabled={btnLoading || !supplementFile}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Upload Asset'}
              </button>
           </form>

           <div className="bg-white rounded-[2rem] border border-gray-50 shadow-sm overflow-hidden">
              <div className="p-6 bg-gray-50 border-b border-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest">Available Supplements</div>
              <div className="divide-y divide-gray-50">
                 {supplements.map(sup => sup && (
                    <div key={sup._id} className="p-5 px-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                       <div>
                          <p className="font-black text-sm text-gray-900 uppercase tracking-tight">{sup.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Uploaded by {sup.uploadedBy?.name}</p>
                       </div>
                       <button 
                        onClick={() => handleDeleteSupplement(sup._id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 ))}
                 {supplements.length === 0 && (
                   <div className="p-10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest italic">No documents uploaded yet.</div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
