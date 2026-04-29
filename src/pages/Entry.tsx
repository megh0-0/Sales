import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Camera, Plus, Trash2, Upload, Save, X, Loader2, Star, 
  ArrowLeft, Building2, User as UserIcon, Mail, Phone, MapPin, 
  PlusCircle, FileText, MessageSquare, ClipboardList, AlertCircle, Zap,
  RotateCw, Check, Scissors
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/imageUtils';

interface Address {
  street: string;
  area: string;
  city: string;
}

const Entry = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [industries, setIndustries] = useState<{ _id: string, name: string }[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [''],
    primaryPhoneNumber: '',
    emails: [''],
    addresses: [{ street: '', area: '', city: '' }],
    industry: 'General',
    leadCategory: 'New Lead',
    status: 'Lead generated',
    requirementInfo: '',
    comments: '',
    personalComments: ''
  });

  const [files, setFiles] = useState<{
    visitingCardFront: File | null;
    visitingCardBack: File | null;
    attachment: File | null;
  }>({
    visitingCardFront: null,
    visitingCardBack: null,
    attachment: null
  });

  const [previews, setPreviews] = useState<{
    front: string;
    back: string;
  }>({ front: '', back: '' });

  // Cropping States
  const [cropModal, setCropModal] = useState<{ isOpen: boolean; type: 'front' | 'back' | null; image: string }>({
    isOpen: false,
    type: null,
    image: ''
  });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/industries`);
      setIndustries(res.data || []);
    } catch (err) {
      console.error('Failed to fetch industries');
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, _croppedAreaPixels: any) => {
    setCroppedAreaPixels(_croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      const croppedBlob = await getCroppedImg(cropModal.image, croppedAreaPixels, rotation);
      if (croppedBlob && cropModal.type) {
        const file = new File([croppedBlob], `visiting_card_${cropModal.type}.jpg`, { type: 'image/jpeg' });
        setFiles(prev => ({ ...prev, [cropModal.type === 'front' ? 'visitingCardFront' : 'visitingCardBack']: file }));
        setPreviews(prev => ({ ...prev, [cropModal.type!]: URL.createObjectURL(croppedBlob) }));
        setCropModal({ isOpen: false, type: null, image: '' });
        setRotation(0);
        setZoom(1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCamera = async (type: 'front' | 'back') => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true,
        saveToGallery: true
      });

      if (image.webPath) {
        setCropModal({ isOpen: true, type, image: image.webPath });
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back' | 'attachment') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'attachment') {
        setFiles(prev => ({ ...prev, attachment: file }));
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setCropModal({ isOpen: true, type, image: reader.result as string });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (type: 'front' | 'back') => {
    setFiles(prev => ({ ...prev, [type === 'front' ? 'visitingCardFront' : 'visitingCardBack']: null }));
    setPreviews(prev => ({ ...prev, [type]: '' }));
  };

  const handleOCR = async () => {
    const imagesToProcess = [files.visitingCardFront, files.visitingCardBack].filter(f => f !== null);
    if (imagesToProcess.length === 0) return;

    setOcrLoading(true);
    const ocrData = new FormData();
    imagesToProcess.forEach(img => ocrData.append('images', img as File));

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/leads/ocr`, ocrData);
      const parsed = res.data.parsedData;
      
      setFormData(prev => ({
        ...prev,
        companyName: parsed.companyName || prev.companyName,
        contactPersonName: parsed.contactPersonName || prev.contactPersonName,
        designation: parsed.designation || prev.designation,
        phoneNumbers: parsed.phoneNumbers?.length ? parsed.phoneNumbers : prev.phoneNumbers,
        emails: parsed.emails?.length ? parsed.emails : prev.emails,
        addresses: (parsed.addresses && parsed.addresses.length > 0) ? parsed.addresses : prev.addresses,
      }));

      if (parsed.phoneNumbers?.length > 0 && !formData.primaryPhoneNumber) {
        setFormData(prev => ({ ...prev, primaryPhoneNumber: parsed.phoneNumbers[0] }));
      }
    } catch (err) {
      console.error('OCR failed', err);
      alert('Failed to extract data from card');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFieldChange = (field: 'phoneNumbers' | 'emails', index: number, value: string) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData(prev => {
      let primary = prev.primaryPhoneNumber;
      if (field === 'phoneNumbers' && (!primary || prev.phoneNumbers.length === 1)) {
        primary = value;
      }
      return { ...prev, [field]: updated, primaryPhoneNumber: primary };
    });
  };

  const addField = (field: 'phoneNumbers' | 'emails' | 'addresses') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], field === 'addresses' ? { street: '', area: '', city: '' } : '']
    }));
  };

  const removeField = (field: 'phoneNumbers' | 'emails' | 'addresses', index: number) => {
    setFormData(prev => {
      const updated = prev[field].filter((_, i) => i !== index);
      let primary = prev.primaryPhoneNumber;
      if (field === 'phoneNumbers' && prev.phoneNumbers[index] === primary) {
        primary = (updated[0] as string) || '';
      }
      return { ...prev, [field]: updated, primaryPhoneNumber: primary };
    });
  };

  const togglePrimary = (phone: string) => {
    setFormData(prev => ({ ...prev, primaryPhoneNumber: phone }));
  };

  const handleAddressChange = (index: number, key: keyof Address, value: string) => {
    const updated = [...formData.addresses];
    updated[index] = { ...updated[index], [key]: value };
    setFormData(prev => ({ ...prev, addresses: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (['phoneNumbers', 'emails', 'addresses'].includes(key)) {
        submitData.append(key, JSON.stringify(value));
      } else {
        submitData.append(key, value as string);
      }
    });

    if (files.visitingCardFront) submitData.append('visitingCardFront', files.visitingCardFront);
    if (files.visitingCardBack) submitData.append('visitingCardBack', files.visitingCardBack);
    if (files.attachment) submitData.append('attachment', files.attachment);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/leads`, submitData);
      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-8 px-4">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-50">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-2">Success!</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asset captured & indexed successfully.</p>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row gap-4">
           <button 
            onClick={() => window.location.reload()} 
            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100"
           >
             New Entry
           </button>
           <button 
            onClick={() => navigate('/data-bank')} 
            className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest"
           >
             Go to Bank
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8 px-4 sm:px-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Lead Entry</h1>
        </div>
        {ocrLoading && (
          <div className="flex items-center text-blue-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            Extracting Data...
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 mx-4 sm:mx-0 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest">
           <AlertCircle className="w-4 h-4" />
           {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Visiting Card Section */}
        <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 sm:p-10 space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Step 1: Visiting Card Capture</h3>
               <button 
                type="button" 
                onClick={handleOCR}
                disabled={ocrLoading || (!files.visitingCardFront && !files.visitingCardBack)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
               >
                 <Zap className={clsx("w-3.5 h-3.5", ocrLoading && "animate-pulse")} />
                 {ocrLoading ? 'Extracting...' : 'Extract Data'}
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Front Side */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Front Side Image</label>
                <div className="relative aspect-video bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden group">
                  {previews.front ? (
                    <>
                      <img src={previews.front} alt="Front" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button type="button" onClick={() => handleCamera('front')} className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-blue-50 transition-colors"><Camera className="w-5 h-5" /></button>
                        <label className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                        </label>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeImage('front')}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                        <Camera className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button type="button" onClick={() => handleCamera('front')} className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors">Take Photo</button>
                        <label className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors cursor-pointer">
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Back Side */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Back Side Image (Optional)</label>
                <div className="relative aspect-video bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden group">
                  {previews.back ? (
                    <>
                      <img src={previews.back} alt="Back" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button type="button" onClick={() => handleCamera('back')} className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-blue-50 transition-colors"><Camera className="w-5 h-5" /></button>
                        <label className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                        </label>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeImage('back')}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                        <Camera className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button type="button" onClick={() => handleCamera('back')} className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors">Take Photo</button>
                        <label className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors cursor-pointer">
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lead Details Section */}
        <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 sm:p-12 space-y-10">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Step 2: Lead Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Company Name</label>
                <input type="text" name="companyName" required value={formData.companyName} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Industry</label>
                <select name="industry" value={formData.industry} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                  {industries.map(ind => <option key={ind._id} value={ind.name}>{ind.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Person</label>
                <input type="text" name="contactPersonName" required value={formData.contactPersonName} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lead Category</label>
                <select name="leadCategory" value={formData.leadCategory} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="New Lead">New Lead</option>
                  <option value="Existing Lead">Existing Lead</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="Lead generated">Lead generated</option>
                  <option value="Potential">Potential</option>
                  <option value="Interested">Interested</option>
                  <option value="Quotation submitted">Quotation submitted</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed">Closed</option>
                  <option value="Sales Complete">Sales Complete</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Numbers</label>
                {formData.phoneNumbers.map((phone, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="tel" 
                        value={phone} 
                        onChange={(e) => handleFieldChange('phoneNumbers', idx, e.target.value)} 
                        className={clsx(
                          "w-full bg-white border rounded-xl p-3 text-sm font-bold transition-colors",
                          formData.primaryPhoneNumber === phone && phone ? "border-yellow-400 ring-2 ring-yellow-50" : "border-gray-200"
                        )} 
                      />
                      <button 
                        type="button" 
                        onClick={() => togglePrimary(phone)}
                        className={clsx(
                          "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
                          formData.primaryPhoneNumber === phone && phone ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"
                        )}
                      >
                        <Star className={clsx("w-4 h-4", formData.primaryPhoneNumber === phone && "fill-current")} />
                      </button>
                    </div>
                    {formData.phoneNumbers.length > 1 && (
                      <button type="button" onClick={() => removeField('phoneNumbers', idx)} className="text-red-300 hover:text-red-500 p-2 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addField('phoneNumbers')} className="text-blue-600 text-[10px] font-black uppercase flex items-center gap-1.5 ml-1 mt-1 active:scale-95 transition-transform">
                  <Plus className="w-3 h-3" /> Add Phone
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Addresses</label>
                {formData.emails.map((email, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="email" value={email} onChange={(e) => handleFieldChange('emails', idx, e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold flex-1" />
                    {formData.emails.length > 1 && (
                      <button type="button" onClick={() => removeField('emails', idx)} className="text-red-300 hover:text-red-500 p-2 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addField('emails')} className="text-blue-600 text-[10px] font-black uppercase flex items-center gap-1.5 ml-1 mt-1 active:scale-95 transition-transform">
                  <Plus className="w-3 h-3" /> Add Email
                </button>
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Addresses</label>
                  <button type="button" onClick={() => addField('addresses')} className="text-blue-600 text-[9px] font-black uppercase flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Address
                  </button>
               </div>
               {formData.addresses.map((addr, idx) => (
                  <div key={idx} className="p-6 bg-gray-50 rounded-2xl space-y-4 relative group border border-gray-100">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Address #{idx + 1}</span>
                        {formData.addresses.length > 1 && (
                          <button type="button" onClick={() => removeField('addresses', idx)} className="text-red-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                     </div>
                     <input type="text" placeholder="Street / Building Details" value={addr.street} onChange={(e) => handleAddressChange(idx, 'street', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold" />
                     <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Area" value={addr.area} onChange={(e) => handleAddressChange(idx, 'area', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold" />
                        <input type="text" placeholder="City" value={addr.city} onChange={(e) => handleAddressChange(idx, 'city', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold" />
                     </div>
                  </div>
               ))}
            </div>
          </div>
        </section>

        {/* Step 3: Strategic Assets */}
        <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 sm:p-12 space-y-10">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Step 3: Strategic Assets</h3>
            <div className="space-y-8">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Requirement Info
                </label>
                <textarea name="requirementInfo" rows={4} value={formData.requirementInfo} onChange={handleChange} placeholder="Enter technical requirements, specifications, etc." className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]" />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Additional Attachment</label>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <FileText className="w-6 h-6 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-900 truncate">{files.attachment ? files.attachment.name : 'No file selected'}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{files.attachment ? `${(files.attachment.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, DOCX, JPG supported'}</p>
                  </div>
                  <label className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
                    {files.attachment ? 'Change' : 'Choose File'}
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'attachment')} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: Intelligence Feed */}
        <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 sm:p-12 space-y-10">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Step 4: Intelligence Feed</h3>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> Lead's Comments
                  </label>
                  <textarea name="comments" rows={3} value={formData.comments} onChange={handleChange} placeholder="Shared with team" className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-amber-600">
                    <Star className="w-3.5 h-3.5" /> Personal Comments (Private)
                  </label>
                  <textarea name="personalComments" rows={3} value={formData.personalComments} onChange={handleChange} placeholder="For your reference only" className="w-full bg-amber-50/30 border border-amber-100 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none min-h-[100px]" />
                </div>
              </div>
              <div className="pt-8 flex justify-end gap-4 border-t border-gray-100">
                <button type="button" onClick={() => navigate('/')} className="px-10 py-4 text-gray-400 font-black uppercase text-xs tracking-widest hover:text-gray-600 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-3">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Lead Entry
                </button>
              </div>
            </div>
          </div>
        </section>
      </form>

      {/* Crop Modal */}
      {cropModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] overflow-hidden w-full max-w-2xl h-[80vh] flex flex-col relative">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
               <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">Refine Capture</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Crop and rotate for better extraction</p>
               </div>
               <button onClick={() => setCropModal({ isOpen: false, type: null, image: '' })} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>

            <div className="flex-1 relative bg-gray-100">
              <Cropper
                image={cropModal.image}
                crop={crop}
                rotation={rotation}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-8 bg-white border-t border-gray-100 z-10 space-y-6">
              <div className="flex items-center gap-6">
                 <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                       <span>Zoom</span>
                       <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 </div>
                 <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                       <span>Rotation</span>
                       <span>{rotation}°</span>
                    </div>
                    <input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 </div>
                 <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-3 bg-gray-50 text-gray-900 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <RotateCw className="w-5 h-5" />
                 </button>
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setCropModal({ isOpen: false, type: null, image: '' })} className="flex-1 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Discard</button>
                 <button onClick={handleCropSave} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Finalize Selection
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entry;
