import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Eye, Search, X, Building2, MapPin, Phone, Mail, Share2, 
  Download, User as UserIcon, Loader2, Star, ClipboardList, 
  Clock, MessageSquare, Printer, ChevronDown, ChevronRight,
  Database, Filter
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
  enteredBy: { _id: string, name: string, phone: string };
  shares: { sharedBy: { _id: string, name: string, phone: string }, sharedAt: string }[];
  createdAt: string;
  followUps?: FollowUp[];
}

const SharedData = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchSharedLeads();
  }, []);

  const fetchSharedLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads/shared`);
      setLeads(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch shared leads', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return (leads || []).filter(lead => 
      (lead.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (lead.contactPersonName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.primaryPhoneNumber || lead.phoneNumbers?.[0] || '').includes(searchTerm)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leads, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedLeads(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'closed': case 'sales complete': return 'bg-emerald-500';
      case 'interested': return 'bg-blue-600';
      case 'potential': return 'bg-blue-400';
      case 'quotation submitted': return 'bg-indigo-500';
      default: return 'bg-blue-500';
    }
  };

  const getDriveImageUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    return url;
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
          <div className="p-4 bg-purple-600 text-white rounded-3xl shadow-xl shadow-purple-100">
            <Share2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-1">Shared Intelligence</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Distributed Asset Repository</p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search shared assets..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* List View - Consistent with Data Bank */}
      <div className="space-y-4">
        {filteredLeads.map((lead) => {
          const mainShare = lead.shares?.find(s => s.sharedBy?._id !== user?._id) || lead.shares?.[0];
          return (
            <div key={lead._id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
               <div 
                onClick={() => toggleExpand(lead._id)}
                className="p-6 flex items-center justify-between cursor-pointer group"
               >
                  <div className="flex items-center gap-4 flex-1">
                     <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Building2 className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="font-black text-gray-900 uppercase tracking-tight">{lead.companyName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lead.contactPersonName}</span>
                           <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                           <span className="text-[10px] font-black text-purple-600 uppercase tracking-tighter">Shared By {mainShare?.sharedBy?.name || 'Team'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                     <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        <Phone className="w-3.5 h-3.5 text-purple-400" />
                        {lead.primaryPhoneNumber || lead.phoneNumbers?.[0]}
                     </div>
                     <span className={clsx("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white", getStatusColor(lead.status))}>
                        {lead.status}
                     </span>
                     {expandedLeads.includes(lead._id) ? <ChevronDown className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                  </div>
               </div>

               {expandedLeads.includes(lead._id) && (
                  <div className="p-8 bg-gray-50/50 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Contact Intelligence</p>
                           <div className="space-y-3">
                              <div className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                 <UserIcon className="w-4 h-4 text-purple-600 mr-4" />
                                 <div>
                                    <p className="text-sm font-black text-gray-900 uppercase">{lead.contactPersonName}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">{lead.designation || 'N/A'}</p>
                                 </div>
                              </div>
                              <div className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                 <Phone className="w-4 h-4 text-purple-600 mr-4" />
                                 <p className="text-sm font-bold text-gray-700">{lead.phoneNumbers?.join(', ')}</p>
                              </div>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Strategic Requirements</p>
                           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[100px]">
                              <p className="text-sm text-gray-600 leading-relaxed italic">{lead.requirementInfo || 'No requirements documented.'}</p>
                           </div>
                        </div>
                     </div>
                     <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button onClick={() => { setSelectedLead(lead); setIsViewModalOpen(true); }} className="px-8 py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all flex items-center gap-2 shadow-lg">
                           <Eye className="w-4 h-4" /> Review Full Intel
                        </button>
                     </div>
                  </div>
               )}
            </div>
          );
        })}

        {filteredLeads.length === 0 && (
          <div className="bg-white p-20 text-center rounded-[3rem] border-2 border-dashed border-gray-100">
             <Share2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
             <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">No shared assets found.</p>
          </div>
        )}
      </div>

      {/* View Modal - Consistent with Data Bank */}
      {isViewModalOpen && selectedLead && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 animate-in zoom-in-95 duration-300 no-scrollbar">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-6 flex justify-between items-center z-20">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-purple-600 text-white rounded-3xl shadow-lg shadow-purple-100">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">{selectedLead.companyName}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Shared Intel Review</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="bg-gray-100 text-gray-500 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section>
                  <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                    <MessageSquare className="w-4 h-4 mr-2 text-purple-600" /> Identity Details
                  </h4>
                  <div className="space-y-2">
                    {selectedLead.phoneNumbers?.map((p, i) => (
                      <div key={i} className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-sm">
                        <Phone className="w-4 h-4 text-purple-600 mr-3" /> {p}
                      </div>
                    ))}
                    {selectedLead.emails?.map((e, i) => (
                      <div key={i} className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-sm">
                        <Mail className="w-4 h-4 text-purple-600 mr-3" /> {e}
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                    <MapPin className="w-4 h-4 mr-2 text-purple-600" /> Geographical Intelligence
                  </h4>
                  <div className="space-y-3">
                    {selectedLead.addresses?.map((a, i) => (
                      <div key={i} className="flex items-start p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <MapPin className="w-4 h-4 text-purple-600 mr-4 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{a.street}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{a.area}, {a.city}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <section>
                   <h4 className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                     <MessageSquare className="w-4 h-4 mr-2 text-purple-600" /> General Comments
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
                  <Download className="w-4 h-4 mr-2 text-purple-600" /> Digitized Assets
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
    </div>
  );
};

export default SharedData;
