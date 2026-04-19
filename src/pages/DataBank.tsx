import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Edit2, Search, Filter, Calendar, X, Download, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

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
  visitingCardFront?: string;
  visitingCardBack?: string;
  attachment?: string;
  requirementInfo?: string;
  comments?: string;
  enteredBy: { name: string, phone: string };
  createdAt: string;
}

const DataBank = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    const filtered = leads.filter(lead => {
      const matchesSearch = lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           lead.contactPersonName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter ? lead.leadCategory === categoryFilter : true;
      const matchesIndustry = industryFilter ? lead.industry === industryFilter : true;
      return matchesSearch && matchesCategory && matchesIndustry;
    });
    setFilteredLeads(filtered);
  }, [searchTerm, categoryFilter, industryFilter, leads]);

  const fetchLeads = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads`);
      setLeads(res.data);
      setFilteredLeads(res.data);
    } catch (err) {
      console.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (lead: Lead) => {
    setSelectedLead(lead);
    setIsViewModalOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditModalOpen(true);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Data Bank</h1>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search company or person..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">All Categories</option>
            <option value="New Lead">New Lead</option>
            <option value="Existing Lead">Existing Lead</option>
            <option value="Collected">Collected</option>
          </select>
          {/* Industry filter would ideally be populated from industries list */}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredLeads.map((lead) => (
            <li key={lead._id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-600 truncate">{lead.companyName}</p>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center text-xs text-gray-500 gap-2 sm:gap-4">
                      <div className="flex items-center">
                        <UserIcon className="flex-shrink-0 mr-1 h-3 w-3" />
                        {lead.contactPersonName} ({lead.designation})
                      </div>
                      <div className="flex items-center">
                        <Calendar className="flex-shrink-0 mr-1 h-3 w-3" />
                        {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className={clsx(
                        "px-2 py-0.5 rounded-full font-medium",
                        lead.leadCategory === 'New Lead' ? "bg-green-100 text-green-800" :
                        lead.leadCategory === 'Existing Lead' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                      )}>
                        {lead.leadCategory}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button onClick={() => handleView(lead)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                      <Eye className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleEdit(lead)} className="p-2 text-gray-400 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {(user?.role !== 'Employee') && (
                  <div className="mt-2 text-[10px] text-gray-400">
                    Entered by: {lead.enteredBy.name}
                  </div>
                )}
              </div>
            </li>
          ))}
          {filteredLeads.length === 0 && (
            <li className="px-4 py-12 text-center text-gray-500">No leads found matching your criteria.</li>
          )}
        </ul>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedLead && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setIsViewModalOpen(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{selectedLead.companyName}</h3>
                  <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-500"><X className="w-6 h-6" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Person</h4>
                      <p className="text-sm text-gray-900 font-medium">{selectedLead.contactPersonName}</p>
                      <p className="text-xs text-gray-500">{selectedLead.designation}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Numbers</h4>
                      <div className="space-y-1">
                        {selectedLead.phoneNumbers.map((p, i) => <p key={i} className="text-sm text-gray-900">{p}</p>)}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Emails</h4>
                      <div className="space-y-1">
                        {selectedLead.emails.map((e, i) => <p key={i} className="text-sm text-gray-900">{e}</p>)}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Addresses</h4>
                      <div className="space-y-2">
                        {selectedLead.addresses.map((a, i) => (
                          <div key={i} className="text-sm text-gray-900">
                            {a.street}, {a.area}, {a.city}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Visiting Card</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedLead.visitingCardFront && (
                          <a href={selectedLead.visitingCardFront} target="_blank" rel="noreferrer" className="block border rounded p-1">
                            <img src={selectedLead.visitingCardFront} alt="Front" className="w-full h-20 object-cover rounded" />
                            <span className="text-[10px] text-center block mt-1">Front Side</span>
                          </a>
                        )}
                        {selectedLead.visitingCardBack && (
                          <a href={selectedLead.visitingCardBack} target="_blank" rel="noreferrer" className="block border rounded p-1">
                            <img src={selectedLead.visitingCardBack} alt="Back" className="w-full h-20 object-cover rounded" />
                            <span className="text-[10px] text-center block mt-1">Back Side</span>
                          </a>
                        )}
                      </div>
                    </div>
                    {selectedLead.attachment && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Attachment</h4>
                        <a href={selectedLead.attachment} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-600 text-sm hover:underline">
                          <Download className="w-4 h-4 mr-1" /> View/Download File
                        </a>
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Requirements</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedLead.requirementInfo || 'No requirements entered.'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Comments</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedLead.comments || 'No comments entered.'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button onClick={() => setIsViewModalOpen(false)} className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBank;
