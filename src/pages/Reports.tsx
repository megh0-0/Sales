import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format, isToday, isThisWeek, isThisMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, User as UserIcon, Clock, 
  TrendingUp, Calendar, Printer, FileText,
  Filter, Search, Loader2, Phone, MapPin, ChevronDown, ChevronRight, Database
} from 'lucide-react';
import { clsx } from 'clsx';

interface Lead {
  _id: string;
  companyName: string;
  contactPersonName: string;
  designation?: string;
  phoneNumbers: string[];
  emails: string[];
  addresses: { street: string; area: string; city: string }[];
  industry: string;
  status: string;
  projectValue?: number;
  requirementInfo?: string;
  comments?: string;
  personalComments?: string;
  enteredBy: { _id: string, name: string, role: string };
  createdAt: string;
}

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'leads' | 'sales'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  
  // Filters
  const [timeFilter, setTimeFilter] = useState<'all' | 'custom'>('all');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leadsRes, usersRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/leads`),
        axios.get(`${import.meta.env.VITE_API_URL}/users`)
      ]);
      setLeads(leadsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return (leads || []).filter(l => {
      if (!l) return false;
      const date = new Date(l.createdAt);
      
      const matchesUser = userFilter === 'All' || l.enteredBy?._id === userFilter;
      if (!matchesUser) return false;

      if (timeFilter === 'custom') {
        try {
          const start = startOfDay(new Date(startDate));
          const end = endOfDay(new Date(endDate));
          return isWithinInterval(date, { start, end });
        } catch {
          return true;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leads, userFilter, timeFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const l = leads || [];
    const fl = filteredLeads || [];
    return {
      daily: l.filter(lead => lead && (userFilter === 'All' || lead.enteredBy?._id === userFilter) && isToday(new Date(lead.createdAt))).length,
      weekly: l.filter(lead => lead && (userFilter === 'All' || lead.enteredBy?._id === userFilter) && isThisWeek(new Date(lead.createdAt))).length,
      monthly: l.filter(lead => lead && (userFilter === 'All' || lead.enteredBy?._id === userFilter) && isThisMonth(new Date(lead.createdAt))).length,
      totalSales: fl.filter(lead => lead && ['Closed', 'Sales Complete'].includes(lead.status)).reduce((sum, lead) => sum + (lead.projectValue || 0), 0),
      pipelineValue: fl.reduce((sum, lead) => sum + (lead ? (lead.projectValue || 0) : 0), 0),
    };
  }, [leads, filteredLeads, userFilter]);

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

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Intelligence Reports</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Analytical Performance Metrics</p>
        </div>
        <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex w-full md:w-auto">
          <button
            onClick={() => setActiveTab('leads')}
            className={clsx(
              "flex-1 md:px-8 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'leads' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Leads Report
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={clsx(
              "flex-1 md:px-8 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'sales' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Sales Report
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
             <Filter className="w-3.5 h-3.5" /> Employee Filter
          </span>
          <select 
            value={userFilter} 
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="All">All Employees</option>
            {users.map(u => u && <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
             <Calendar className="w-3.5 h-3.5" /> Date Range
          </span>
          <div className="flex items-center gap-2 w-full">
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setTimeFilter('custom'); }} className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold" />
            <span className="text-gray-300 font-bold">to</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setTimeFilter('custom'); }} className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold" />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center text-center group">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
            {activeTab === 'leads' ? <Clock className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
          </div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            {activeTab === 'leads' ? "Today's Assets" : "Completed Sales"}
          </h3>
          <p className="text-4xl font-black text-gray-900 tracking-tighter italic">
            {activeTab === 'leads' ? stats.daily : `৳${stats.totalSales.toLocaleString()}`}
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center text-center group">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
            {activeTab === 'leads' ? <TrendingUp className="w-6 h-6" /> : <Database className="w-6 h-6" />}
          </div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            {activeTab === 'leads' ? "Weekly Volume" : "Pipeline Value"}
          </h3>
          <p className="text-4xl font-black text-gray-900 tracking-tighter italic">
            {activeTab === 'leads' ? stats.weekly : `৳${stats.pipelineValue.toLocaleString()}`}
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center text-center group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            {activeTab === 'leads' ? "Monthly Goal" : "Goal Conversion"}
          </h3>
          <p className="text-4xl font-black text-gray-900 tracking-tighter italic">
            {activeTab === 'leads' ? stats.monthly : `${((stats.totalSales / (stats.pipelineValue || 1)) * 100).toFixed(0)}%`}
          </p>
        </div>
      </div>

      {/* List View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">
                {activeTab === 'leads' ? 'Intelligence Stream' : 'Sales Pipeline'}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{filteredLeads.length} items analyzed</p>
           </div>
        </div>

        <div className="space-y-3">
          {filteredLeads.map((lead) => (
            <div key={lead._id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
               <div 
                onClick={() => toggleExpand(lead._id)}
                className="p-5 flex items-center justify-between cursor-pointer group"
               >
                  <div className="flex items-center gap-4 flex-1">
                     <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Building2 className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate max-w-[200px] md:max-w-md">{lead.companyName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lead.contactPersonName}</span>
                           <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                           <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">By {lead.enteredBy?.name || 'Unknown'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                     <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5" />
                        {lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yyyy') : 'N/A'}
                     </div>
                     <span className={clsx("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white", getStatusColor(lead.status))}>
                        {lead.status}
                     </span>
                     {expandedLeads.includes(lead._id) ? <ChevronDown className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                  </div>
               </div>

               {expandedLeads.includes(lead._id) && (
                  <div className="p-6 bg-gray-50/50 border-t border-gray-50 animate-in slide-in-from-top-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                        <div className="space-y-4">
                           <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Company Details</p>
                              <p className="font-bold text-gray-700">{lead.industry} • {lead.addresses?.[0]?.city || 'N/A'}</p>
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Contact Information</p>
                              <p className="font-bold text-gray-700 flex items-center gap-2">
                                 <Phone className="w-3.5 h-3.5 text-blue-400" /> {lead.phoneNumbers?.join(', ') || 'N/A'}
                              </p>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Analytical Notes</p>
                           <p className="text-gray-600 leading-relaxed italic">{lead.comments || 'No operational comments recorded.'}</p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">No analytical data available for this range.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
