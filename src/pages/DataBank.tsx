import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Eye, Search, Calendar, X, Download, User as UserIcon, Building2, 
  ChevronDown, ChevronRight, CheckCircle2, Clock, MapPin, Phone, 
  Mail, Edit3, Share2, Plus, Trash2, Save, Loader2, Printer, 
  TrendingUp, Star, MoreVertical, MessageSquare, ClipboardList, 
  AlertCircle, DollarSign, Filter, PlusCircle, CheckSquare, Square,
  Zap, Database
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

interface Address {
  street: string;
  area: string;
  city: string;
}

interface FollowUp {
  date: string;
  note: string;
}

interface Lead {
  _id: string;
  companyName: string;
  contactPersonName: string;
  designation: string;
  phoneNumbers: string[];
  primaryPhoneNumber?: string;
  emails: string[];
  addresses: Address[];
  industry: string;
  leadCategory: string;
  status: string;
  projectValue?: number;
  visitingCardFront?: string;
  visitingCardBack?: string;
  attachment?: string;
  requirementInfo?: string;
  comments?: string;
  personalComments?: string;
  followUps?: FollowUp[];
  enteredBy: { _id: string, name: string, phone: string };
  createdAt: string;
}

const DataBank = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Advanced Filters
  const [filterUser, setFilterUser] = useState('All');
  const [filterIndustry, setFilterIndustry] = useState('All');
  const [filterArea, setFilterArea] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  const [industries, setIndustries] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  // Modal States
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isProjectValueModalOpen, setIsProjectValueModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { user } = useAuth();
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Modal Forms
  const [requirementInfo, setRequirementInfo] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [followUp, setFollowUp] = useState({ date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), note: '' });
  const [projectValue, setProjectValue] = useState(0);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  const statusOptions = [
    'Lead generated',
    'Potential',
    'Interested',
    'Quotation submitted',
    'Negotiation',
    'Closed',
    'Sales Complete',
    'Reject'
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [leadsRes, indRes, usersRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/leads`),
        axios.get(`${import.meta.env.VITE_API_URL}/industries`),
        axios.get(`${import.meta.env.VITE_API_URL}/users`)
      ]);
      
      setLeads(leadsRes.data || []);
      setIndustries(indRes.data || []);
      setAllUsers(usersRes.data || []);
      
      const allAreas = Array.from(new Set((leadsRes.data || []).flatMap((l: Lead) => l.addresses?.map(a => a.area)).filter(Boolean)));
      const allCities = Array.from(new Set((leadsRes.data || []).flatMap((l: Lead) => l.addresses?.map(a => a.city)).filter(Boolean)));
      setAreas(allAreas as string[]);
      setCities(allCities as string[]);
    } catch (err) {
      console.error('Failed to fetch data');
      setError('Connection failure');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (lead.companyName?.toLowerCase() || '').includes(searchLower) ||
        (lead.contactPersonName?.toLowerCase() || '').includes(searchLower) ||
        (lead.phoneNumbers || []).some(p => p.includes(searchTerm)) ||
        (lead.emails || []).some(e => e.toLowerCase().includes(searchLower)) ||
        (lead.industry?.toLowerCase() || '').includes(searchLower);
      
      const matchesUser = filterUser === 'All' || lead.enteredBy?._id === filterUser;
      const matchesIndustry = filterIndustry === 'All' || lead.industry === filterIndustry;
      const matchesArea = filterArea === 'All' || lead.addresses?.some(a => a.area === filterArea);
      const matchesCity = filterCity === 'All' || lead.addresses?.some(a => a.city === filterCity);

      return matchesSearch && matchesUser && matchesIndustry && matchesArea && matchesCity;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leads, searchTerm, filterUser, filterIndustry, filterArea, filterCity]);

  const groupedLeads = useMemo(() => {
    const groups: { [key: string]: Lead[] } = {};
    filteredLeads.forEach(lead => {
      if (!groups[lead.companyName]) {
        groups[lead.companyName] = [];
      }
      groups[lead.companyName].push(lead);
    });
    return groups;
  }, [filteredLeads]);

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkShare = async () => {
    if (selectedLeadIds.length === 0 || shareUserIds.length === 0) return;
    setBtnLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/leads/bulk-share`, {
        leadIds: selectedLeadIds,
        userIds: shareUserIds
      });
      alert(`Shared ${selectedLeadIds.length} assets successfully!`);
      setIsShareModalOpen(false);
      setSelectedLeadIds([]);
      setShareUserIds([]);
    } catch (err) {
      alert('Failed to share assets');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleUpdateRequirements = async () => {
    if (!selectedLead) return;
    setBtnLoading(true);
    const formData = new FormData();
    formData.append('requirementInfo', requirementInfo);
    if (attachment) formData.append('attachment', attachment);

    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/leads/${selectedLead._id}`, formData);
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
      setSelectedLead(res.data);
      setIsRequirementModalOpen(false);
    } catch (err) {
      alert('Failed to update requirements');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!selectedLead) return;
    setBtnLoading(true);
    const updatedFollowUps = [...(selectedLead.followUps || []), followUp];
    const formData = new FormData();
    formData.append('followUps', JSON.stringify(updatedFollowUps));

    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/leads/${selectedLead._id}`, formData);
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
      setSelectedLead(res.data);
      setIsFollowUpModalOpen(false);
      setFollowUp({ date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), note: '' });
    } catch (err) {
      alert('Failed to save follow-up');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleUpdateProjectValue = async () => {
    if (!selectedLead) return;
    setBtnLoading(true);
    const formData = new FormData();
    formData.append('projectValue', String(projectValue));

    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/leads/${selectedLead._id}`, formData);
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
      setSelectedLead(res.data);
      setIsProjectValueModalOpen(false);
    } catch (err) {
      alert('Failed to update project value');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    setDeleteLoading(id);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/leads/${id}`);
      setLeads(prev => prev.filter(l => l._id !== id));
    } catch (err) {
      alert('Failed to delete lead');
    } finally {
      setDeleteLoading(null);
    }
  };

  const openEditModal = (lead: Lead) => {
    setEditFormData({ ...lead });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    const formData = new FormData();
    Object.entries(editFormData).forEach(([key, value]) => {
      if (['phoneNumbers', 'emails', 'addresses', 'followUps'].includes(key)) {
        formData.append(key, JSON.stringify(value));
      } else if (key === 'enteredBy' && typeof value === 'object') {
        formData.append(key, (value as any)._id);
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/leads/${editFormData._id}`, formData);
      setLeads(prev => prev.map(l => l._id === editFormData._id ? res.data : l));
      setIsEditModalOpen(false);
    } catch (err) {
      alert('Failed to update lead');
    } finally {
      setBtnLoading(false);
    }
  };

  const toggleExpandCompany = (name: string) => {
    setExpandedCompanies(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const getDriveImageUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    return url;
  };

  const handlePrintCard = (lead: Lead) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const followUpHtml = lead.followUps?.map(f => `
      <div style="margin-bottom: 8px; padding: 10px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 2px;">${format(new Date(f.date), 'MMM dd, yyyy HH:mm')}</p>
        <p style="font-size: 12px; color: #1e293b; margin: 0;">${f.note}</p>
      </div>
    `).join('') || '<p style="color: #cbd5e1; font-style: italic;">No follow-ups recorded</p>';

    printWindow.document.write(`
      <html>
        <head>
          <title>${lead.companyName} - Lead Card</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-8 bg-white">
          <div class="max-w-3xl mx-auto border-2 border-gray-100 rounded-[2.5rem] p-10">
            <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-2">${lead.companyName}</h1>
            <p class="text-xl font-bold text-gray-900 mb-8">${lead.contactPersonName}</p>
            <div class="grid grid-cols-2 gap-12 mb-12">
               <div>
                  <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Communication</p>
                  <p class="text-sm font-bold">P: ${lead.phoneNumbers.join(', ')}</p>
                  <p class="text-sm font-bold">E: ${lead.emails.join(', ')}</p>
               </div>
               <div>
                  <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Location</p>
                  ${lead.addresses.map(a => `<p class="text-sm font-bold">${a.street}, ${a.area}, ${a.city}</p>`).join('')}
               </div>
            </div>
            <div class="bg-blue-50 p-6 rounded-3xl mb-8">
               <p class="text-[10px] font-black text-blue-600 uppercase mb-2">Requirements</p>
               <p class="text-sm italic">${lead.requirementInfo || 'N/A'}</p>
            </div>
            <div>
               <p class="text-[10px] font-black text-gray-400 uppercase mb-4">Follow-ups</p>
               ${followUpHtml}
            </div>
            <button onclick="window.print()" class="mt-10 px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px]">Print</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'closed': case 'sales complete': return 'bg-emerald-500';
      case 'interested': return 'bg-blue-600';
      case 'potential': return 'bg-blue-400';
      case 'quotation submitted': return 'bg-indigo-500';
      case 'negotiation': return 'bg-amber-500';
      case 'reject': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gray-900 text-white rounded-3xl shadow-xl shadow-gray-200">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-1">Intelligence Bank</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Secure Repository of Business Assets</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setIsFilterModalOpen(true)}
            className={clsx(
              "p-4 rounded-2xl border transition-all",
              (filterUser !== 'All' || filterIndustry !== 'All' || filterArea !== 'All' || filterCity !== 'All')
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100"
                : "bg-white text-gray-400 border-gray-100 hover:border-blue-200"
            )}
          >
            <Filter className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* List View - Grouped by Company */}
      <div className="space-y-4">
        {Object.entries(groupedLeads).map(([companyName, companyLeads]) => (
          <div key={companyName} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
             <div 
              onClick={() => toggleExpandCompany(companyName)}
              className="p-6 flex items-center justify-between cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors"
             >
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white border border-gray-100 rounded-2xl text-indigo-600 shadow-sm">
                      <Building2 className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-black text-gray-900 uppercase tracking-tight">{companyName}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {companyLeads.length} Entry{companyLeads.length > 1 ? 'ies' : ''} • {companyLeads[0].industry}
                      </p>
                   </div>
                </div>
                {expandedCompanies.includes(companyName) ? <ChevronDown className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
             </div>

             {expandedCompanies.includes(companyName) && (
                <div className="divide-y divide-gray-50 border-t border-gray-50">
                   {companyLeads.map((lead) => (
                      <div key={lead._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50/30 transition-colors group">
                         <div className="flex items-center gap-4 flex-1">
                            <button 
                              onClick={() => toggleSelectLead(lead._id)}
                              className={clsx(
                                "p-2 rounded-xl transition-all",
                                selectedLeadIds.includes(lead._id) ? "bg-blue-50 text-blue-600" : "text-gray-200 hover:text-blue-400"
                              )}
                            >
                              {selectedLeadIds.includes(lead._id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                            <div className="min-w-0">
                               <p className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{lead.contactPersonName}</p>
                               <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{lead.designation || 'N/A'}</span>
                                  <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                                  <span className={clsx("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter text-white", getStatusColor(lead.status))}>
                                     {lead.status}
                                  </span>
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center gap-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                               <Phone className="w-3.5 h-3.5 text-blue-400" />
                               {lead.primaryPhoneNumber || lead.phoneNumbers[0]}
                            </div>
                            <div className="hidden lg:flex items-center gap-2">
                               <MapPin className="w-3.5 h-3.5 text-blue-400" />
                               {lead.addresses?.[0]?.city || 'N/A'}
                            </div>
                         </div>

                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setSelectedLead(lead); setIsViewModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => openEditModal(lead)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteLead(lead._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                               {deleteLoading === lead._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="bg-white p-20 text-center rounded-[3rem] border-2 border-dashed border-gray-100">
             <Database className="w-12 h-12 text-gray-200 mx-auto mb-4" />
             <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">No intelligence assets matched your search.</p>
          </div>
        )}
      </div>

      {/* Floating Share Action */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom duration-300">
           <button 
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-3 bg-blue-600 text-white px-10 py-5 rounded-full shadow-2xl shadow-blue-200 font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all scale-100 active:scale-95"
           >
             <Share2 className="w-5 h-5" />
             Share {selectedLeadIds.length} Assets
           </button>
           <button 
            onClick={() => setSelectedLeadIds([])}
            className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-2 shadow-lg hover:bg-red-500 transition-colors"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsShareModalOpen(false)}></div>
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl relative z-10 p-8 sm:p-10 animate-in zoom-in-95 duration-300">
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic mb-2">Intelligence Sharing</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Distribute {selectedLeadIds.length} assets to team members</p>
              
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar mb-8">
                 {allUsers.filter(u => u._id !== user?._id).map(u => (
                    <label key={u._id} className={clsx(
                      "flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer",
                      shareUserIds.includes(u._id) ? "border-blue-600 bg-blue-50" : "border-gray-100 hover:border-blue-200"
                    )}>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center font-black text-blue-600 uppercase shadow-sm">
                             {u.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{u.name}</p>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.role}</p>
                          </div>
                       </div>
                       <input 
                        type="checkbox" 
                        className="hidden"
                        checked={shareUserIds.includes(u._id)}
                        onChange={() => setShareUserIds(prev => prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id])}
                       />
                       {shareUserIds.includes(u._id) ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-gray-200" />}
                    </label>
                 ))}
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Cancel</button>
                 <button 
                  onClick={handleBulkShare}
                  disabled={btnLoading || shareUserIds.length === 0}
                  className="flex-1 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 disabled:opacity-50"
                 >
                   {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm Distribution'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Requirement Modal */}
      {isRequirementModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRequirementModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 relative z-10">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic mb-6">Update Requirements</h3>
            <div className="space-y-4">
              <textarea 
                value={requirementInfo} 
                onChange={(e) => setRequirementInfo(e.target.value)}
                placeholder="Enter technical details..."
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none h-40"
              />
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                 <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Attachment</p>
                    <p className="text-xs font-bold text-gray-700 truncate">{attachment ? attachment.name : 'No file selected'}</p>
                 </div>
                 <label className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-sm">
                   {attachment ? 'Change' : 'Choose'}
                   <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                 </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsRequirementModalOpen(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Cancel</button>
                <button 
                  onClick={handleUpdateRequirements} 
                  disabled={btnLoading}
                  className="flex-1 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100"
                >
                  {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Update Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFollowUpModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 relative z-10">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic mb-6">Log Follow-up</h3>
            <div className="space-y-4">
              <input 
                type="datetime-local" 
                value={followUp.date}
                onChange={(e) => setFollowUp({...followUp, date: e.target.value})}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <textarea 
                value={followUp.note} 
                onChange={(e) => setFollowUp({...followUp, note: e.target.value})}
                placeholder="Follow-up notes..."
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none h-32"
              />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsFollowUpModalOpen(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Cancel</button>
                <button 
                  onClick={handleAddFollowUp} 
                  disabled={btnLoading}
                  className="flex-1 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-100"
                >
                  {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedLead && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 animate-in zoom-in-95 duration-300 no-scrollbar">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-6 flex justify-between items-center z-20">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-100">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">{selectedLead.companyName}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Intelligence Asset Review</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrintCard(selectedLead)} className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-all"><Printer className="w-6 h-6" /></button>
                <button onClick={() => setIsViewModalOpen(false)} className="bg-gray-100 text-gray-500 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
              </div>
            </div>

            <div className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section>
                  <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                    <MessageSquare className="w-4 h-4 mr-2 text-blue-600" /> Identity Details
                  </h4>
                  <div className="space-y-6">
                    <div>
                      <p className="text-lg font-black text-gray-900 leading-none">{selectedLead.contactPersonName}</p>
                      <p className="text-xs font-bold text-blue-600 uppercase italic tracking-widest mt-1">{selectedLead.designation || 'Position N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      {selectedLead.phoneNumbers?.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-sm">
                          <span className="flex items-center"><Phone className="w-4 h-4 text-blue-600 mr-3" /> {p}</span>
                          {p === selectedLead.primaryPhoneNumber && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                        </div>
                      ))}
                      {selectedLead.emails?.map((e, i) => (
                        <div key={i} className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-sm">
                          <Mail className="w-4 h-4 text-blue-600 mr-3" /> {e}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                    <MapPin className="w-4 h-4 mr-2 text-blue-600" /> Geographical Intelligence
                  </h4>
                  <div className="space-y-3">
                    {selectedLead.addresses?.map((a, i) => (
                      <div key={i} className="flex items-start p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <MapPin className="w-4 h-4 text-blue-600 mr-4 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{a.street}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{a.area}, {a.city}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section>
                <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                  <ClipboardList className="w-4 h-4 mr-2 text-indigo-600" /> Strategic Requirements
                </h4>
                <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 min-h-[150px]">
                  <p className="text-sm text-indigo-900 leading-relaxed font-medium italic">
                    {selectedLead.requirementInfo || "No specific requirements recorded."}
                  </p>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <section>
                   <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                     <MessageSquare className="w-4 h-4 mr-2 text-blue-600" /> General Comments
                   </h4>
                   <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-sm font-medium text-gray-700">
                      {selectedLead.comments || "No general comments."}
                   </div>
                 </section>
                 <section>
                   <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 text-amber-600">
                     <Star className="w-4 h-4 mr-2" /> Personal Notes
                   </h4>
                   <div className="bg-amber-50/30 p-6 rounded-3xl border border-amber-100 text-sm font-medium text-amber-900 italic">
                      {selectedLead.personalComments || "No personal notes."}
                   </div>
                 </section>
              </div>

              <section>
                <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                  <Clock className="w-4 h-4 mr-2 text-orange-600" /> Follow-up Log
                </h4>
                <div className="space-y-3">
                  {selectedLead.followUps?.map((f, i) => (
                    <div key={i} className="p-5 bg-orange-50/50 border border-orange-100 rounded-2xl flex items-center justify-between">
                       <p className="text-sm font-bold text-orange-900">{f.note}</p>
                       <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{format(new Date(f.date), 'dd MMM, HH:mm')}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                  <Download className="w-4 h-4 mr-2 text-blue-600" /> Digitized Assets
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {selectedLead.visitingCardFront && (
                    <a href={getDriveImageUrl(selectedLead.visitingCardFront)} target="_blank" rel="noreferrer" className="block border-4 border-gray-50 rounded-[2rem] overflow-hidden shadow-lg hover:scale-[1.02] transition-transform">
                      <img src={getDriveImageUrl(selectedLead.visitingCardFront)} alt="Front" className="w-full h-40 object-cover" />
                      <div className="p-3 bg-white text-center text-[10px] font-black text-gray-400 tracking-widest uppercase border-t border-gray-100">Front Card</div>
                    </a>
                  )}
                  {selectedLead.visitingCardBack && (
                    <a href={getDriveImageUrl(selectedLead.visitingCardBack)} target="_blank" rel="noreferrer" className="block border-4 border-gray-50 rounded-[2rem] overflow-hidden shadow-lg hover:scale-[1.02] transition-transform">
                      <img src={getDriveImageUrl(selectedLead.visitingCardBack)} alt="Back" className="w-full h-40 object-cover" />
                      <div className="p-3 bg-white text-center text-[10px] font-black text-gray-400 tracking-widest uppercase border-t border-gray-100">Back Card</div>
                    </a>
                  )}
                  {selectedLead.attachment && (
                    <a href={selectedLead.attachment} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-8 bg-blue-50 border-4 border-white rounded-[2rem] shadow-lg hover:bg-blue-600 group transition-all">
                      <Download className="w-10 h-10 text-blue-600 group-hover:text-white mb-3" />
                      <span className="text-[10px] font-black text-blue-700 group-hover:text-white uppercase tracking-widest">Master Attachment</span>
                    </a>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {/* Project Value Modal */}
      {isProjectValueModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProjectValueModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 relative z-10">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic mb-6">Estimate Project Value</h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Value in BDT</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">৳</span>
                  <input 
                    type="number" 
                    value={projectValue} 
                    onChange={(e) => setProjectValue(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-4 text-xl font-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsProjectValueModalOpen(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Cancel</button>
                <button 
                  onClick={handleUpdateProjectValue} 
                  disabled={btnLoading}
                  className="flex-1 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-100"
                >
                  {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Set Value'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editFormData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 p-8 sm:p-12 no-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Edit Intelligence Asset</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-3 bg-gray-100 text-gray-500 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Company Name</label>
                  <input type="text" value={editFormData.companyName} onChange={(e) => setEditFormData({...editFormData, companyName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Person</label>
                  <input type="text" value={editFormData.contactPersonName} onChange={(e) => setEditFormData({...editFormData, contactPersonName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                   <select value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                      {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                   <select value={editFormData.leadCategory} onChange={(e) => setEditFormData({...editFormData, leadCategory: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                      <option value="New Lead">New Lead</option>
                      <option value="Existing Lead">Existing Lead</option>
                   </select>
                </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phones</label>
                 {editFormData.phoneNumbers.map((p: string, i: number) => (
                    <div key={i} className="flex gap-2">
                       <input type="tel" value={p} onChange={(e) => {
                          const updated = [...editFormData.phoneNumbers];
                          updated[i] = e.target.value;
                          setEditFormData({...editFormData, phoneNumbers: updated});
                       }} className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold" />
                    </div>
                 ))}
              </div>

              <div className="pt-8 border-t border-gray-100 flex gap-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Cancel</button>
                <button 
                  type="submit"
                  disabled={btnLoading}
                  className="flex-1 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-gray-100"
                >
                  {btnLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsFilterModalOpen(false)}></div>
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl relative z-10 p-10 animate-in zoom-in-95 duration-300">
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic mb-8">Intelligence Filters</h3>
              
              <div className="space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">By Employee</label>
                    <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                       <option value="All">All Employees</option>
                       {allUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">By Industry</label>
                    <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                       <option value="All">All Industries</option>
                       {industries.map(i => <option key={i._id} value={i.name}>{i.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">By Area</label>
                       <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                          <option value="All">All Areas</option>
                          {areas.map(a => <option key={a} value={a}>{a}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">By City</label>
                       <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm font-bold">
                          <option value="All">All Cities</option>
                          {cities.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
              </div>

              <div className="mt-10 flex gap-4">
                 <button 
                  onClick={() => {
                    setFilterUser('All');
                    setFilterIndustry('All');
                    setFilterArea('All');
                    setFilterCity('All');
                  }}
                  className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest"
                 >
                   Reset
                 </button>
                 <button 
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
                 >
                   Apply Filters
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DataBank;
