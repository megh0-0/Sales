import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, Eye, Search, Loader2, Calendar, User, Share2, CheckCircle2, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

interface Supplement {
  _id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: { name: string };
  createdAt: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    fetchSupplements();
  }, []);

  const fetchSupplements = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/supplements`);
      setSupplements(res.data);
    } catch (error) {
      console.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleShareSelected = async () => {
    const selectedDocs = supplements.filter(s => selectedIds.includes(s._id));
    if (selectedDocs.length === 0) return;

    setShareLoading(true);
    try {
      // For mobile sharing, we'll try to share the files if they are images/pdfs, 
      // otherwise we share a list of links.
      if (navigator.share) {
        const shareData: any = {
          title: 'Shared Documents',
          text: `Check out these documents:\n\n${selectedDocs.map(d => `${d.name}: ${d.fileUrl}`).join('\n\n')}`
        };

        // Attempt to fetch and share as actual files if supported (better for WhatsApp)
        try {
          const filesToShare = [];
          for (const doc of selectedDocs) {
            const response = await fetch(doc.fileUrl);
            const blob = await response.blob();
            const fileName = doc.name.includes('.') ? doc.name : `${doc.name}.${doc.fileType.split('/')[1] || 'file'}`;
            filesToShare.push(new File([blob], fileName, { type: doc.fileType }));
          }
          
          if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
            shareData.files = filesToShare;
            delete shareData.text; // Use files instead of text if possible
          }
        } catch (e) {
          console.log('Falling back to text sharing');
        }

        await navigator.share(shareData);
      } else {
        const links = selectedDocs.map(d => d.fileUrl).join('\n');
        await navigator.clipboard.writeText(links);
        alert('Document links copied to clipboard!');
      }
    } catch (error) {
      console.error('Sharing failed', error);
    } finally {
      setShareLoading(false);
    }
  };

  const filtered = supplements.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={() => navigate('/')} className="hidden md:flex p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Documents</h1>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s._id);
          return (
            <div 
              key={s._id} 
              onClick={() => toggleSelect(s._id)}
              className={clsx(
                "bg-white p-5 rounded-2xl border-2 transition-all cursor-pointer relative group",
                isSelected ? "border-blue-600 ring-4 ring-blue-50" : "border-gray-100 hover:border-blue-200 shadow-sm"
              )}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg z-10">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              
              <div className="flex items-start gap-4">
                <div className={clsx(
                  "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                )}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate mb-1">{s.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {new Date(s.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center"><User className="w-3 h-3 mr-1" /> {s.uploadedBy?.name}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-6" onClick={e => e.stopPropagation()}>
                <a 
                  href={s.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-center py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 mr-2" /> View
                </a>
                <a 
                  href={s.fileUrl} 
                  download
                  className="flex items-center justify-center py-2 bg-blue-50 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> Download
                </a>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 italic bg-white rounded-3xl border border-gray-100">
            No documents found.
          </div>
        )}
      </div>

      {/* Floating Share Button */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom duration-300">
          <button 
            onClick={handleShareSelected}
            disabled={shareLoading}
            className="flex items-center bg-blue-600 text-white px-8 py-4 rounded-full shadow-2xl shadow-blue-200 font-bold hover:bg-blue-700 transition-all scale-100 active:scale-95"
          >
            {shareLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Share2 className="w-5 h-5 mr-2" />
            )}
            Share {selectedIds.length} {selectedIds.length === 1 ? 'Document' : 'Documents'}
          </button>
          <button 
            onClick={() => setSelectedIds([])}
            className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1.5 shadow-lg"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Documents;
