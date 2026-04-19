import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, Plus, Trash2, Upload, Save, X, Loader2 } from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { clsx } from 'clsx';

interface Address {
  street: string;
  area: string;
  city: string;
}

const Entry = () => {
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [industries, setIndustries] = useState<{ _id: string, name: string }[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [''],
    emails: [''],
    addresses: [{ street: '', area: '', city: '' }],
    industry: '',
    leadCategory: 'New Lead',
    requirementInfo: '',
    comments: ''
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

  useEffect(() => {
    fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/industries`);
      setIndustries(res.data);
    } catch (err) {
      console.error('Failed to fetch industries');
    }
  };

  const handleAddField = (field: 'phoneNumbers' | 'emails' | 'addresses') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], field === 'addresses' ? { street: '', area: '', city: '' } : '']
    }));
  };

  const handleRemoveField = (field: 'phoneNumbers' | 'emails' | 'addresses', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFieldChange = (field: 'phoneNumbers' | 'emails', index: number, value: string) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData(prev => ({ ...prev, [field]: updated }));
  };

  const handleAddressChange = (index: number, key: keyof Address, value: string) => {
    const updated = [...formData.addresses];
    updated[index] = { ...updated[index], [key]: value };
    setFormData(prev => ({ ...prev, addresses: updated }));
  };

  const takePhoto = async (type: 'front' | 'back') => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `visiting_card_${type}.jpg`, { type: 'image/jpeg' });
        
        setFiles(prev => ({ ...prev, [type === 'front' ? 'visitingCardFront' : 'visitingCardBack']: file }));
        setPreviews(prev => ({ ...prev, [type]: image.webPath! }));

        if (type === 'front') {
          handleOCR(file);
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const handleOCR = async (file: File) => {
    setOcrLoading(true);
    const formDataOCR = new FormData();
    formDataOCR.append('image', file);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/leads/ocr`, formDataOCR);
      const parsed = res.data.parsedData;
      
      setFormData(prev => ({
        ...prev,
        companyName: parsed.companyName || prev.companyName,
        contactPersonName: parsed.contactPersonName || prev.contactPersonName,
        designation: parsed.designation || prev.designation,
        phoneNumbers: parsed.phoneNumbers.length > 0 ? parsed.phoneNumbers : prev.phoneNumbers,
        emails: parsed.emails.length > 0 ? parsed.emails : prev.emails,
        // Merging addresses can be complex, for now we just take what OCR found if anything
        addresses: parsed.addresses[0].street ? parsed.addresses : prev.addresses
      }));
    } catch (err) {
      console.error('OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const submitData = new FormData();
    // Append simple fields
    Object.entries(formData).forEach(([key, value]) => {
      if (['phoneNumbers', 'emails', 'addresses'].includes(key)) {
        submitData.append(key, JSON.stringify(value));
      } else {
        submitData.append(key, value as string);
      }
    });

    // Append files
    if (files.visitingCardFront) submitData.append('visitingCardFront', files.visitingCardFront);
    if (files.visitingCardBack) submitData.append('visitingCardBack', files.visitingCardBack);
    if (files.attachment) submitData.append('attachment', files.attachment);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/leads`, submitData);
      setSuccess(true);
      // Reset form
      setFormData({
        companyName: '',
        contactPersonName: '',
        designation: '',
        phoneNumbers: [''],
        emails: [''],
        addresses: [{ street: '', area: '', city: '' }],
        industry: '',
        leadCategory: 'New Lead',
        requirementInfo: '',
        comments: ''
      });
      setFiles({ visitingCardFront: null, visitingCardBack: null, attachment: null });
      setPreviews({ front: '', back: '' });
      window.scrollTo(0, 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Lead Entry</h1>
        {ocrLoading && (
          <div className="flex items-center text-blue-600 text-sm font-medium animate-pulse">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Extracting data from card...
          </div>
        )}
      </div>

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 text-green-400">✓</div>
            <div className="ml-3 text-sm text-green-700">Lead saved successfully!</div>
            <button onClick={() => setSuccess(false)} className="ml-auto text-green-500"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0 text-red-400">!</div>
            <div className="ml-3 text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Lead Details */}
        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">1. Lead Details</h3>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-6">
            {/* Camera Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Front Side Image</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-2 h-40 flex flex-col items-center justify-center overflow-hidden">
                  {previews.front ? (
                    <img src={previews.front} alt="Front" className="h-full w-full object-contain" />
                  ) : (
                    <button type="button" onClick={() => takePhoto('front')} className="flex flex-col items-center text-gray-500">
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-xs">Take Front Photo</span>
                    </button>
                  )}
                  {previews.front && (
                    <button type="button" onClick={() => setPreviews(p => ({ ...p, front: '' }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Back Side Image</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-2 h-40 flex flex-col items-center justify-center overflow-hidden">
                  {previews.back ? (
                    <img src={previews.back} alt="Back" className="h-full w-full object-contain" />
                  ) : (
                    <button type="button" onClick={() => takePhoto('back')} className="flex flex-col items-center text-gray-500">
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-xs">Take Back Photo</span>
                    </button>
                  )}
                  {previews.back && (
                    <button type="button" onClick={() => setPreviews(p => ({ ...p, back: '' }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">Company Name</label>
                <input type="text" name="companyName" required value={formData.companyName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">Contact Person Name</label>
                <input type="text" name="contactPersonName" required value={formData.contactPersonName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">Industry</label>
                <select name="industry" value={formData.industry} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option value="">Select Industry</option>
                  {industries.map(ind => <option key={ind._id} value={ind.name}>{ind.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">Lead Category</label>
                <select name="leadCategory" value={formData.leadCategory} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option value="New Lead">New Lead</option>
                  <option value="Existing Lead">Existing Lead</option>
                  <option value="Collected">Collected</option>
                </select>
              </div>
            </div>

            {/* Dynamic Phones */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Phone Numbers</label>
              {formData.phoneNumbers.map((phone, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="tel" value={phone} onChange={(e) => handleFieldChange('phoneNumbers', idx, e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  {formData.phoneNumbers.length > 1 && (
                    <button type="button" onClick={() => handleRemoveField('phoneNumbers', idx)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => handleAddField('phoneNumbers')} className="text-blue-600 text-sm flex items-center mt-1"><Plus className="w-3 h-3 mr-1" /> Add Number</button>
            </div>

            {/* Dynamic Emails */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Emails</label>
              {formData.emails.map((email, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="email" value={email} onChange={(e) => handleFieldChange('emails', idx, e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  {formData.emails.length > 1 && (
                    <button type="button" onClick={() => handleRemoveField('emails', idx)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => handleAddField('emails')} className="text-blue-600 text-sm flex items-center mt-1"><Plus className="w-3 h-3 mr-1" /> Add Email</button>
            </div>

            {/* Dynamic Addresses */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Addresses</label>
              {formData.addresses.map((addr, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-md space-y-3 bg-gray-50/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address {idx + 1}</span>
                    {formData.addresses.length > 1 && (
                      <button type="button" onClick={() => handleRemoveField('addresses', idx)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                  <input type="text" placeholder="Street/Building" value={addr.street} onChange={(e) => handleAddressChange(idx, 'street', e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Area" value={addr.area} onChange={(e) => handleAddressChange(idx, 'area', e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    <input type="text" placeholder="City" value={addr.city} onChange={(e) => handleAddressChange(idx, 'city', e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => handleAddField('addresses')} className="text-blue-600 text-sm flex items-center mt-1"><Plus className="w-3 h-3 mr-1" /> Add Address</button>
            </div>
          </div>
        </section>

        {/* Section 2: Requirement Information */}
        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">2. Requirement Information (Optional)</h3>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <textarea name="requirementInfo" rows={4} value={formData.requirementInfo} onChange={handleChange} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Enter requirements..."></textarea>
            <div>
              <label className="block text-sm font-medium text-gray-700">Attachment</label>
              <div className="mt-1 flex items-center">
                <input type="file" id="attachment" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, attachment: e.target.files ? e.target.files[0] : null }))} />
                <label htmlFor="attachment" className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="w-4 h-4 mr-2" />
                  {files.attachment ? files.attachment.name : 'Choose File'}
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Comments */}
        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">3. Lead's Comments (Optional)</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <textarea name="comments" rows={4} value={formData.comments} onChange={handleChange} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Any additional comments..."></textarea>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Save Lead Entry
          </button>
        </div>
      </form>
    </div>
  );
};

export default Entry;
