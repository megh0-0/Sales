import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Search, Calendar, X, Download, User as UserIcon, Building2, ChevronDown, ChevronRight, CheckCircle2, Clock, MapPin, Phone, Mail, Edit3, Share2, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

interface Address {
  street: string;
  area: string;
  city: string;
}

interface Lead {
  _id: string;
  companyName: string;
  contactPersonName: string;
  designation: string;
  phoneNumbers: string[];
  emails: string[];
  addresses: Address[];
  industry: string;
  leadCategory: string;
  status: string;
  visitingCardFront?: string;
  visitingCardBack?: string;
  attachment?: string;
  requirementInfo?: string;
  comments?: string;
  enteredBy: { name: string, phone: string };
  createdAt: string;
}

const STATUS_OPTIONS = [
  'Lead generated',
  'Potential',
  'Quotation submitted',
  'On going negotiation',
  'Sales Complete'
];

const DataBank = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [groupedLeads, setGroupedLeads] = useState<Record<string, Lead[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Share State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    const filtered = leads.filter(lead => {
      return (lead.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
             (lead.contactPersonName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    });

    const groups: Record<string, Lead[]> = {};
    filtered.forEach(lead => {
      const company = lead.companyName || 'Unknown Company';
      if (!groups[company]) groups[company] = [];
      groups[company].push(lead);
    });
    setGroupedLeads(groups);
  }, [searchTerm, leads]);

  const fetchLeads = async () => {
    try {
      setError(null);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads`);
      if (Array.isArray(res.data)) {
        setLeads(res.data);
      } else {
        console.error('Data is not an array:', res.data);
        setError('Received invalid data from server');
      }
    } catch (err: any) {
      console.error('Failed to fetch leads', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/leads/${leadId}`, { status: newStatus });
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleGroupStatusChange = async (companyName: string, newStatus: string) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/leads/status/company`, { companyName, status: newStatus });
      setLeads(prev => prev.map(l => l.companyName === companyName ? { ...l, status: newStatus } : l));
    } catch (err) {
      alert('Failed to update group status');
    }
  };

  const toggleGroup = (company: string) => {
    setExpandedGroups(prev => ({ ...prev, [company]: !prev[company] }));
  };

  // Helper to fix Google Drive image visibility
  const getDriveImageUrl = (url: string | undefined) => {
    if (!url) return '';
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    return url;
  };

  // Edit Handlers
  const openEdit = (lead: Lead) => {
    setEditFormData({ ...lead });
    setIsEditModalOpen(true);
  };

  const handleEditChange = (e: any) => {
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: value });
  };

  const handleArrayChange = (field: string, index: number, value: any) => {
    const updated = [...editFormData[field]];
    updated[index] = value;
    setEditFormData({ ...editFormData, [field]: updated });
  };

  const handleAddressChange = (index: number, key: keyof Address, value: string) => {
    const updated = [...editFormData.addresses];
    updated[index] = { ...updated[index], [key]: value };
    setEditFormData({ ...editFormData, addresses: updated });
  };

  const addField = (field: string) => {
    const newVal = field === 'addresses' ? { street: '', area: '', city: '' } : '';
    setEditFormData({ ...editFormData, [field]: [...editFormData[field], newVal] });
  };

  const removeField = (field: string, index: number) => {
    setEditFormData({ ...editFormData, [field]: editFormData[field].filter((_: any, i: number) => i !== index) });
  };

  const submitEdit = async () => {
    setEditLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/leads/${editFormData._id}`, editFormData);
      setLeads(prev => prev.map(l => l._id === editFormData._id ? { ...editFormData } : l));
      setIsEditModalOpen(false);
    } catch (err) {
      alert('Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  // Share Handlers
  const openShare = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsShareModalOpen(true);
    setSelectedUserIds([]);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
      setUsers(res.data.filter((u: any) => u._id !== user?._id));
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const submitShare = async () => {
    if (selectedUserIds.length === 0) return;
    setShareLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/leads/${selectedLead?._id}/share`, { userIds: selectedUserIds });
      setIsShareModalOpen(false);
      alert('Lead shared successfully!');
    } catch (err) {
      alert('Failed to share lead');
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-4 max-w-md">
          <p className="font-bold mb-1">Unable to load leads</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
        <button 
          onClick={fetchLeads}
          className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 px-2 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Data Bank</h1>
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search company or person..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
          />
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(groupedLeads).map((company) => (
          <div key={company} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gray-50/50 p-4 border-b border-gray-100">
              <div className="flex flex-col space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => toggleGroup(company)}>
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 leading-tight">{company}</span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{groupedLeads[company].length} total entries</span>
                    </div>
                  </div>
                  <button onClick={() => toggleGroup(company)} className="p-1">
                    {expandedGroups[company] ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Company Status</span>
                    <select 
                      value={groupedLeads[company][0].status}
                      onChange={(e) => handleGroupStatusChange(company, e.target.value)}
                      className="text-xs font-bold text-blue-700 bg-blue-50 border-none rounded-lg py-1.5 focus:ring-0 cursor-pointer"
                    >
                      {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {expandedGroups[company] && (
              <div className="divide-y divide-gray-100 bg-white">
                {groupedLeads[company]?.map((lead) => (
                  <div key={lead._id} className="p-4 flex flex-col space-y-3 active:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 leading-none">{lead.contactPersonName || 'No Name'}</p>
                        <p className="text-xs text-gray-500 mt-1">{lead.designation || 'No Designation'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openShare(lead)} className="p-2 bg-gray-50 text-purple-600 rounded-lg hover:bg-purple-100"><Share2 className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(lead)} className="p-2 bg-gray-50 text-orange-600 rounded-lg hover:bg-orange-100"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => { setSelectedLead(lead); setIsViewModalOpen(true); }} className="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-100"><Eye className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">{lead.industry || 'Unknown'}</span>
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> {lead.createdAt ? format(new Date(lead.createdAt), 'MMM d') : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entry Status</span>
                       <select 
                          value={lead.status || 'Lead generated'}
                          onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                          className={clsx(
                            "text-[10px] font-extrabold border-none rounded-full px-3 py-1 ring-1 ring-inset",
                            lead.status === 'Sales Complete' ? "bg-green-100 text-green-700 ring-green-600/20" : 
                            lead.status === 'Lead generated' ? "bg-gray-100 text-gray-600 ring-gray-500/20" :
                            "bg-orange-100 text-orange-700 ring-orange-600/20"
                          )}
                        >
                          {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedLead && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto relative z-10 animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Building2 className="w-5 h-5 text-blue-600" /></div>
                <h3 className="text-lg font-bold text-gray-900 truncate max-w-[200px]">{selectedLead.companyName}</h3>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-8">
              <section className="space-y-4">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">{selectedLead.contactPersonName}</p>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedLead.designation}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {selectedLead.phoneNumbers?.map((p, i) => <div key={i} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm"><Phone className="w-4 h-4 text-blue-600 mr-3" />{p}</div>)}
                  {selectedLead.emails?.map((e, i) => <div key={i} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm"><Mail className="w-4 h-4 text-blue-600 mr-3" />{e}</div>)}
                </div>
              </section>
              <section>
                <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.2em] mb-3">Addresses</h4>
                {selectedLead.addresses?.map((a, i) => (
                  <div key={i} className="flex items-start p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-700">{a.street}{a.area ? `, ${a.area}` : ''}{a.city ? `, ${a.city}` : ''}</p>
                  </div>
                ))}
              </section>
              <section>
                <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.2em] mb-3">Visiting Cards</h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedLead.visitingCardFront && (
                    <a href={selectedLead.visitingCardFront} target="_blank" rel="noreferrer" className="block border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <img src={getDriveImageUrl(selectedLead.visitingCardFront)} alt="Front" className="w-full h-28 object-cover" />
                      <div className="p-2 bg-white text-center border-t border-gray-100 text-[10px] font-bold text-gray-500">FRONT SIDE</div>
                    </a>
                  )}
                  {selectedLead.visitingCardBack && (
                    <a href={selectedLead.visitingCardBack} target="_blank" rel="noreferrer" className="block border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <img src={getDriveImageUrl(selectedLead.visitingCardBack)} alt="Back" className="w-full h-28 object-cover" />
                      <div className="p-2 bg-white text-center border-t border-gray-100 text-[10px] font-bold text-gray-500">BACK SIDE</div>
                    </a>
                  )}
                </div>
              </section>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end rounded-b-2xl">
              <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editFormData && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto relative z-10 animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-20">
              <h3 className="text-lg font-bold text-gray-900">Edit Lead Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Company Name</label>
                <input type="text" name="companyName" value={editFormData.companyName} onChange={handleEditChange} className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Contact Person</label>
                <input type="text" name="contactPersonName" value={editFormData.contactPersonName} onChange={handleEditChange} className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Designation</label>
                <input type="text" name="designation" value={editFormData.designation} onChange={handleEditChange} className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Phone Numbers</label>
                {editFormData.phoneNumbers.map((p: string, i: number) => (
                  <div key={i} className="flex space-x-2 mb-2">
                    <input type="tel" value={p} onChange={(e) => handleArrayChange('phoneNumbers', i, e.target.value)} className="flex-1 border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-blue-500" />
                    {editFormData.phoneNumbers.length > 1 && <button onClick={() => removeField('phoneNumbers', i)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                <button onClick={() => addField('phoneNumbers')} className="text-blue-600 text-xs font-bold flex items-center"><Plus className="w-3 h-3 mr-1" /> Add Phone</button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Emails</label>
                {editFormData.emails.map((e: string, i: number) => (
                  <div key={i} className="flex space-x-2 mb-2">
                    <input type="email" value={e} onChange={(e) => handleArrayChange('emails', i, e.target.value)} className="flex-1 border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-blue-500" />
                    {editFormData.emails.length > 1 && <button onClick={() => removeField('emails', i)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                <button onClick={() => addField('emails')} className="text-blue-600 text-xs font-bold flex items-center"><Plus className="w-3 h-3 mr-1" /> Add Email</button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Addresses</label>
                {editFormData.addresses.map((a: Address, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 mb-3">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-gray-400 uppercase">Address {i+1}</span>
                    {editFormData.addresses.length > 1 && <button onClick={() => removeField('addresses', i)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                    <input type="text" placeholder="Street" value={a.street} onChange={(e) => handleAddressChange(i, 'street', e.target.value)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-xs" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Area" value={a.area} onChange={(e) => handleAddressChange(i, 'area', e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs" />
                      <input type="text" placeholder="City" value={a.city} onChange={(e) => handleAddressChange(i, 'city', e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs" />
                    </div>
                  </div>
                ))}
                <button onClick={() => addField('addresses')} className="text-blue-600 text-xs font-bold flex items-center"><Plus className="w-3 h-3 mr-1" /> Add Address</button>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
              <button onClick={submitEdit} disabled={editLoading} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 flex items-center">
                {editLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><Share2 className="w-5 h-5 mr-2 text-purple-600" /> Share Lead</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {users.map((u) => (
                <div 
                  key={u._id} 
                  onClick={() => toggleUserSelection(u._id)}
                  className={clsx(
                    "p-3 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all",
                    selectedUserIds.includes(u._id) ? "border-purple-600 bg-purple-50" : "border-gray-100 bg-gray-50 hover:border-gray-300"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs">{u.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{u.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{u.role}</p>
                  </div>
                  {selectedUserIds.includes(u._id) && <div className="p-1 bg-purple-600 rounded-full text-white"><CheckCircle2 className="w-3 h-3" /></div>}
                </div>
              ))}
              {users.length === 0 && <p className="text-center text-gray-400 py-4 italic">No users available.</p>}
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold">Cancel</button>
              <button 
                onClick={submitShare} 
                disabled={shareLoading || selectedUserIds.length === 0}
                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-100 disabled:opacity-50 flex items-center justify-center"
              >
                {shareLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Share Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBank;
