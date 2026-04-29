import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, Share2, Copy, User as UserIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const VisitingCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentCard, setCurrentCard] = useState<string | null>(user?.visitingCard || null);

  useEffect(() => {
    const fetchLatestUser = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`);
        if (res.data.visitingCard) {
          setCurrentCard(res.data.visitingCard);
        }
      } catch (err) {
        console.error('Failed to sync user data');
      }
    };
    fetchLatestUser();
  }, []);

  const getDriveImageUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    return url;
  };

  const handleDownload = async () => {
    const cardUrl = getDriveImageUrl(currentCard);
    if (!cardUrl) return;
    try {
      const response = await fetch(cardUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VC_${user?.name}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert('Failed to download card');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4">
      <div className="flex items-center gap-4 mb-12">
        <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">My Card</h1>
      </div>

      {!currentCard ? (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <UserIcon className="w-12 h-12 text-gray-200" />
          </div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">No Digital Card Assigned</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest max-w-xs mx-auto">Please contact your administrator to sync your digital asset.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Card Image */}
          <div className="flex justify-center">
             <div className="bg-white rounded-[2rem] border-8 border-white shadow-2xl overflow-hidden max-w-2xl w-full aspect-[1.58/1]">
                <img 
                  src={getDriveImageUrl(currentCard)} 
                  alt={user?.name} 
                  className="w-full h-full object-contain"
                />
             </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <button 
              onClick={handleDownload}
              className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] border border-gray-50 shadow-sm hover:bg-blue-50 hover:border-blue-100 transition-all group"
            >
              <Download className="w-6 h-6 text-gray-300 group-hover:text-blue-600 mb-3" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-700">Download</span>
            </button>

            <button 
              className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] border border-gray-50 shadow-sm hover:bg-purple-50 hover:border-purple-100 transition-all group"
            >
              <Share2 className="w-6 h-6 text-gray-300 group-hover:text-purple-600 mb-3" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-purple-700">Share Card</span>
            </button>

            <button 
              onClick={() => {
                if (currentCard) {
                  navigator.clipboard.writeText(currentCard);
                  alert('Link copied!');
                }
              }}
              className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] border border-gray-50 shadow-sm hover:bg-orange-50 hover:border-orange-100 transition-all group"
            >
              <Copy className="w-6 h-6 text-gray-300 group-hover:text-orange-600 mb-3" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-orange-700">Copy Link</span>
            </button>
          </div>

          {/* Profile Card */}
          <div className="max-w-2xl mx-auto">
             <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-100 flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-black text-3xl uppercase">
                  {user?.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{user?.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                    Team Member • {user?.role}
                  </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitingCard;
