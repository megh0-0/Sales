import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { Building2, User as UserIcon, CheckCircle2, Clock, TrendingUp, ChevronRight, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface Lead {
  _id: string;
  companyName: string;
  contactPersonName: string;
  industry: string;
  status: string;
  requirementInfo?: string;
  createdAt: string;
}

const STATUS_ORDER = [
  'Lead generated',
  'Potential',
  'Quotation submitted',
  'On going negotiation',
  'Sales Complete'
];

const STATUS_PROGRESS: Record<string, number> = {
  'Lead generated': 0,
  'Potential': 25,
  'Quotation submitted': 50,
  'On going negotiation': 75,
  'Sales Complete': 100
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'leads' | 'sales'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  const { user } = useAuth();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setError(null);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads`);
      if (Array.isArray(res.data)) {
        setLeads(res.data);
      } else {
        setError('Received invalid data from server');
      }
    } catch (err: any) {
      console.error('Failed to fetch leads', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeadsByTime = leads.filter(l => {
    const date = new Date(l.createdAt);
    if (timeFilter === 'today') return isToday(date);
    if (timeFilter === 'week') return isThisWeek(date);
    if (timeFilter === 'month') return isThisMonth(date);
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredSalesLeads = leads
    .filter(l => statusFilter === 'All' || l.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    daily: leads.filter(l => isToday(new Date(l.createdAt))).length,
    weekly: leads.filter(l => isThisWeek(new Date(l.createdAt))).length,
    monthly: leads.filter(l => isThisMonth(new Date(l.createdAt))).length,
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-4 max-w-md">
          <p className="font-bold mb-1">Unable to load reports</p>
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
    <div className="max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Performance Reports</h1>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('leads')}
            className={clsx(
              "flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'leads' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Leads Report
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={clsx(
              "flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'sales' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Sales Report
          </button>
        </div>
      </div>

      {activeTab === 'leads' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <button 
              onClick={() => setTimeFilter(timeFilter === 'today' ? 'all' : 'today')}
              className={clsx(
                "p-6 rounded-2xl shadow-sm border transition-all flex flex-col items-center text-center group",
                timeFilter === 'today' ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-100 hover:border-blue-300"
              )}
            >
              <div className={clsx("p-3 rounded-full mb-4", timeFilter === 'today' ? "bg-blue-500" : "bg-blue-50")}>
                <Clock className={clsx("w-6 h-6", timeFilter === 'today' ? "text-white" : "text-blue-600")} />
              </div>
              <h3 className={clsx("text-xs font-bold uppercase tracking-widest mb-1", timeFilter === 'today' ? "text-blue-100" : "text-gray-500")}>Today</h3>
              <p className="text-4xl font-extrabold">{stats.daily}</p>
            </button>

            <button 
              onClick={() => setTimeFilter(timeFilter === 'week' ? 'all' : 'week')}
              className={clsx(
                "p-6 rounded-2xl shadow-sm border transition-all flex flex-col items-center text-center group",
                timeFilter === 'week' ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-100 hover:border-purple-300"
              )}
            >
              <div className={clsx("p-3 rounded-full mb-4", timeFilter === 'week' ? "bg-purple-500" : "bg-purple-50")}>
                <TrendingUp className={clsx("w-6 h-6", timeFilter === 'week' ? "text-white" : "text-purple-600")} />
              </div>
              <h3 className={clsx("text-xs font-bold uppercase tracking-widest mb-1", timeFilter === 'week' ? "text-purple-100" : "text-gray-500")}>This Week</h3>
              <p className="text-4xl font-extrabold">{stats.weekly}</p>
            </button>

            <button 
              onClick={() => setTimeFilter(timeFilter === 'month' ? 'all' : 'month')}
              className={clsx(
                "p-6 rounded-2xl shadow-sm border transition-all flex flex-col items-center text-center group",
                timeFilter === 'month' ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-100 hover:border-green-300"
              )}
            >
              <div className={clsx("p-3 rounded-full mb-4", timeFilter === 'month' ? "bg-green-500" : "bg-green-50")}>
                <TrendingUp className={clsx("w-6 h-6", timeFilter === 'month' ? "text-white" : "text-green-600")} />
              </div>
              <h3 className={clsx("text-xs font-bold uppercase tracking-widest mb-1", timeFilter === 'month' ? "text-green-100" : "text-gray-500")}>This Month</h3>
              <p className="text-4xl font-extrabold">{stats.monthly}</p>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold text-gray-900">
                {timeFilter === 'all' ? "All Leads" : `${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}'s Leads`}
              </h2>
              <span className="text-xs font-medium text-gray-500">{filteredLeadsByTime.length} leads</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {filteredLeadsByTime.map((lead) => (
                <div key={lead._id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-blue-600 font-bold">
                      {lead.companyName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{lead.companyName}</h4>
                      <p className="text-[11px] text-gray-500 flex items-center">
                        <UserIcon className="w-3 h-3 mr-1" /> {lead.contactPersonName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-gray-400 flex items-center justify-end">
                      <Calendar className="w-3 h-3 mr-1" /> {format(new Date(lead.createdAt), 'MMM d')}
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
                      {lead.status}
                    </span>
                  </div>
                </div>
              ))}
              {filteredLeadsByTime.length === 0 && (
                <div className="bg-gray-50 p-12 text-center rounded-2xl border-2 border-dashed border-gray-200">
                   <p className="text-gray-400 font-medium italic">No leads found for this period.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
            {['All', ...STATUS_ORDER].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  "px-4 py-2 text-[10px] sm:text-xs font-bold rounded-full border transition-all shadow-sm whitespace-nowrap",
                  statusFilter === status 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-400"
                )}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredSalesLeads.map((lead) => (
              <div key={lead._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> {lead.companyName}
                      </h3>
                      <div className="flex items-center mt-1 text-xs text-gray-500 flex-wrap gap-y-1">
                        <span className="flex items-center"><UserIcon className="w-3 h-3 mr-1" /> {lead.contactPersonName}</span>
                        <span className="mx-2 text-gray-300 hidden sm:inline">•</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">{lead.industry}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                       <span className="text-[9px] font-bold text-gray-400 uppercase">{format(new Date(lead.createdAt), 'MMM d, yy')}</span>
                       {lead.requirementInfo && (
                         <div className="flex items-center justify-end mt-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{lead.status}</span>
                       <span className="text-[10px] font-bold text-gray-400">{STATUS_PROGRESS[lead.status]}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          "h-full transition-all duration-1000",
                          lead.status === 'Sales Complete' ? "bg-green-500" : "bg-blue-500"
                        )}
                        style={{ width: `${STATUS_PROGRESS[lead.status]}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between mt-3 px-1">
                       {STATUS_ORDER.map((s, idx) => (
                         <div key={s} className={clsx(
                            "w-2 h-2 rounded-full",
                            STATUS_ORDER.indexOf(lead.status) >= idx ? "bg-blue-600" : "bg-gray-200"
                         )}></div>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
