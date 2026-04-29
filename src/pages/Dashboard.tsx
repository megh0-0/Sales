import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircle, Database, BarChart3, Share2, 
  Contact, FileText, Target, Clock, Zap, ArrowRight,
  TrendingUp, Award, Activity, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0,
    target: 0,
    completed: 0
  });
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/leads/dashboard-stats`);
      setStats(res.data);
      
      const followUpsRes = await axios.get(`${import.meta.env.VITE_API_URL}/leads/upcoming-followups`);
      setUpcomingFollowUps(followUpsRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data');
    }
  };

  const menuItems = [
    { title: 'LEAD ENTRY', desc: 'Capture New Assets', icon: PlusCircle, path: '/entry', color: 'from-blue-500 to-indigo-600' },
    { title: 'DATA BANK', desc: 'Manage Repository', icon: Database, path: '/data-bank', color: 'from-indigo-500 to-purple-600' },
    { title: 'REPORTS', desc: 'Analyze Performance', icon: BarChart3, path: '/reports', color: 'from-purple-500 to-pink-600' },
    { title: 'SHARED LEADS', desc: 'Team Intelligence', icon: Share2, path: '/shared-leads', color: 'from-orange-500 to-red-600' },
    { title: 'MY CARD', desc: 'Digital Identity', icon: Contact, path: '/my-card', color: 'from-emerald-500 to-teal-600' },
    { title: 'DOCUMENTS', desc: 'Global Assets', icon: FileText, path: '/documents', color: 'from-sky-500 to-blue-600' },
  ];

  if (user?.role === 'Admin' || user?.role === 'Owner') {
    menuItems.push({ title: 'SETTINGS', desc: 'Admin Control', icon: Settings, path: '/settings', color: 'from-gray-700 to-gray-900' });
  }

  const targetPercentage = Math.min(100, (stats.completed / (stats.target || 1)) * 100);

  return (
    <div className={clsx(
      "max-w-7xl mx-auto space-y-10 pb-20 px-4 sm:px-6 transition-all duration-700",
      isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      
      {/* Dynamic Header Section */}
      <header className="relative pt-6">
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 md:space-y-2">
            {/* Logo visible above name on mobile */}
            <div className="md:hidden animate-bounce-slow">
              <img src="/company_logo.png" alt="Logo" className="h-10 w-auto object-contain drop-shadow-sm" />
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1 animate-pulse">Executive Access</p>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-tight uppercase break-words max-w-[300px] md:max-w-none">
                {user?.name}<span className="text-blue-600">.</span>
              </h1>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> {user?.role} • Strategic Division
              </p>
            </div>
          </div>

          <div className="hidden md:block bg-white p-5 px-10 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-50 transform hover:scale-105 transition-transform">
            <img src="/company_logo.png" alt="THE AIRCONS LTD." className="h-10 w-auto object-contain" />
          </div>
        </div>
      </header>

      {/* Main Operations Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Core Operations</h2>
           <div className="h-px flex-1 bg-gray-100 mx-6"></div>
           <Activity className="w-4 h-4 text-blue-600" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 px-2 sm:px-0">
          {menuItems.map((item, idx) => (
            <button
              key={item.title}
              onClick={() => navigate(item.path)}
              style={{ animationDelay: `${idx * 100}ms` }}
              className="group relative bg-white p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-500 text-center animate-in zoom-in-95 fill-mode-both"
            >
              <div className={clsx(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl mx-auto flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-lg mb-4 bg-gradient-to-br",
                item.color
              )}>
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 className="text-[9px] sm:text-[11px] font-black text-gray-900 tracking-tight uppercase leading-tight mb-1">{item.title}</h3>
                <p className="hidden sm:block text-[8px] font-bold text-gray-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.desc}</p>
              </div>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <ArrowRight className="w-3 h-3 text-blue-600" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Strategic Intelligence Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Performance Hub */}
        <div className="space-y-6">
          <div className="bg-white rounded-[3rem] h-full p-10 shadow-2xl shadow-emerald-100/50 border-4 border-emerald-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
               <TrendingUp className="w-32 h-32 text-emerald-600" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em]">Growth Performance</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{format(new Date(), 'MMMM yyyy')} Fiscal Cycle</p>
                </div>
                <div className="p-4 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-200">
                  <Target className="w-7 h-7" />
                </div>
              </div>

              <div className="space-y-8">
                <div>
                   <p className="text-5xl font-black text-gray-900 tracking-tighter italic leading-none mb-2">৳{stats.completed.toLocaleString()}</p>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Verified Revenue Generated</p>
                </div>
                
                <div className="space-y-3">
                   <div className="h-4 bg-gray-50 rounded-full overflow-hidden border-2 border-white shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-1000 ease-out relative"
                        style={{ width: `${targetPercentage}%` }}
                      >
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-shimmer"></div>
                      </div>
                   </div>
                   <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                         <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{targetPercentage.toFixed(1)}% Conversion</p>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Target: <span className="text-gray-900 font-black">৳{stats.target.toLocaleString()}</span></p>
                   </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-50 flex justify-between items-center">
                 <button onClick={() => navigate('/reports')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:translate-x-2 transition-transform flex items-center gap-2">
                    Detailed Analytics <ArrowRight className="w-3.5 h-3.5" />
                 </button>
                 {targetPercentage >= 100 && (
                   <span className="flex items-center gap-2 text-amber-500 animate-bounce">
                      <Award className="w-5 h-5 fill-current" />
                      <span className="text-[10px] font-black uppercase">Quota Smashed</span>
                   </span>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Follow ups */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[3rem] h-full p-8 border border-gray-100 shadow-xl flex-1 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
                   <Clock className="w-5 h-5" />
                 </div>
                 <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Up coming follow ups</h3>
              </div>
              <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase tracking-tighter">Live Intel</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-2 no-scrollbar">
               {upcomingFollowUps.map((fu, idx) => (
                  <div 
                    key={idx} 
                    className="bg-gray-50/50 p-5 rounded-3xl border border-gray-50 flex items-center justify-between group hover:bg-white hover:border-orange-200 hover:shadow-lg transition-all duration-300"
                  >
                     <div className="flex-1 min-w-0 mr-4">
                        <p className="text-xs font-black text-gray-900 uppercase truncate mb-1 group-hover:text-orange-600 transition-colors">{fu.companyName}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter leading-tight line-clamp-1">{fu.note || 'Strategic follow-up required'}</p>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <div className="bg-white text-gray-900 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter shadow-sm border border-gray-100">
                           {fu.date ? format(new Date(fu.date), 'MMM dd') : 'APR 29'}
                        </div>
                        <p className="text-[8px] font-black text-orange-500 uppercase">{fu.date ? format(new Date(fu.date), 'HH:mm') : '10:00'}</p>
                     </div>
                  </div>
               ))}
               {upcomingFollowUps.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                     <Clock className="w-12 h-12 text-gray-300 mb-4" />
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">No Scheduled Follow Ups Detected.</p>
                  </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* System Integrity Notification */}
      <div className="flex justify-center">
        <div className="bg-gray-950 rounded-full px-8 py-4 text-white shadow-2xl relative overflow-hidden group hover:px-12 transition-all duration-500">
          <div className="absolute inset-0 bg-blue-600 opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
                <Zap className="w-4 h-4 text-white" />
             </div>
             <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Engine v2.0 Active</h4>
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Real-time asset analysis and OCR encryption active.</p>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -40px 0; }
          100% { background-position: 40px 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .fill-mode-both {
          animation-fill-mode: both;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
