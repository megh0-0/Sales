import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Search, Calendar, X, Download, User as UserIcon, Building2, ChevronDown, ChevronRight, CheckCircle2, Clock, MapPin, Phone, Mail, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

interface Lead {
  _id: string;
  companyName: string;
  contactPersonName: string;
  designation: string;
  phoneNumbers: string[];
  emails: string[];
  addresses: { street: string, area: string, city: string }[];
  industry: string;
  leadCategory: string;
  status: string;
  visitingCardFront?: string;
  visitingCardBack?: string;
  attachment?: string;
  requirementInfo?: string;
  comments?: string;
  enteredBy: { name: string, phone: string };
  shares: { sharedBy: { name: string, phone: string }, sharedAt: string }[];
  createdAt: string;
}

const SharedData = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchSharedLeads();
  }, []);

  const fetchSharedLeads = async () => {
    try {
      setError(null);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads/shared-with-me`);
      if (Array.isArray(res.data)) {
        setLeads(res.data);
      } else {
        setError('Received invalid data from server');
      }
    } catch (err: any) {
      console.error('Failed to fetch shared leads', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => 
    (lead.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (lead.contactPersonName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Helper to fix Google Drive image visibility
  const getDriveImageUrl = (url: string | undefined) => {
    if (!url) return '';
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    return url;
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-4 max-w-md">
          <p className="font-bold mb-1">Unable to load shared leads</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
        <button 
          onClick={fetchSharedLeads}
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
        <h1 className="text-2xl font-bold text-gray-900">Shared Data</h1>
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search shared leads..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLeads.map((lead) => (
          <div key={lead._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow p-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{lead.companyName}</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{lead.contactPersonName}</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedLead(lead); setIsViewModalOpen(true); }}
                className="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">{lead.industry}</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md flex items-center">
                <Share2 className="w-3 h-3 mr-1" /> Shared by: {lead.shares.find(s => s.sharedBy._id !== user?._id)?.sharedBy.name || lead.enteredBy.name}
              </span>
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="bg-white p-12 text-center rounded-2xl border-2 border-dashed border-gray-200">
            <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No shared records found.</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedLead && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto relative z-10 animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 truncate max-w-[200px]">{selectedLead.companyName}</h3>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 bg-gray-100 hover:text-gray-600 p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-8">
              <section className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><UserIcon className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">{selectedLead.contactPersonName || 'No Name'}</p>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedLead.designation || 'No Designation'}</p>
                    <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">{selectedLead.industry || 'No Industry'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
                  {selectedLead.phoneNumbers?.map((p, i) => (
                    <a key={i} href={`tel:${p}`} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-300 transition-colors">
                      <Phone className="w-4 h-4 text-blue-600 mr-3" />
                      <span className="text-sm font-bold text-gray-800">{p}</span>
                    </a>
                  ))}
                  {selectedLead.emails?.map((e, i) => (
                    <a key={i} href={`mailto:${e}`} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-300 transition-colors overflow-hidden">
                      <Mail className="w-4 h-4 text-blue-600 mr-3 flex-shrink-0" />
                      <span className="text-sm font-bold text-gray-800 truncate">{e}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.2em] mb-3">Office Locations</h4>
                <div className="space-y-3">
                  {selectedLead.addresses?.map((a, i) => (
                    <div key={i} className="flex items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <MapPin className="w-4 h-4 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-700 leading-relaxed">
                        {a.street}{a.area ? `, ${a.area}` : ''}{a.city ? `, ${a.city}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.2em] mb-3">Business Cards</h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedLead.visitingCardFront && (
                    <a href={selectedLead.visitingCardFront} target="_blank" rel="noreferrer" className="block border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <img src={getDriveImageUrl(selectedLead.visitingCardFront)} alt="Front" className="w-full h-28 object-cover" />
                      <div className="p-2 bg-white text-center border-t border-gray-100"><span className="text-[10px] font-bold text-gray-500">FRONT SIDE</span></div>
                    </a>
                  )}
                  {selectedLead.visitingCardBack && (
                    <a href={selectedLead.visitingCardBack} target="_blank" rel="noreferrer" className="block border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <img src={getDriveImageUrl(selectedLead.visitingCardBack)} alt="Back" className="w-full h-28 object-cover" />
                      <div className="p-2 bg-white text-center border-t border-gray-100"><span className="text-[10px] font-bold text-gray-500">BACK SIDE</span></div>
                    </a>
                  )}
                </div>
              </section>

              <section className="pb-4">
                 <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <h4 className="text-[10px] font-extrabold text-yellow-700 uppercase tracking-widest mb-2 flex items-center">
                       <CheckCircle2 className="w-3 h-3 mr-1.5" /> Requirements & Notes
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedLead.requirementInfo || 'No requirements specified.'}
                    </p>
                 </div>
                 {selectedLead.attachment && (
                    <a href={selectedLead.attachment} target="_blank" rel="noreferrer" className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
                      <Download className="w-4 h-4 mr-2" /> Download Attachment
                    </a>
                 )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedData;
