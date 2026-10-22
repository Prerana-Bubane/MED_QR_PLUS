import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, Scan, Heart, Info, Calendar, Activity, User, QrCode, FileText, ArrowUpRight, Plus, X, Trash2, Send, Bot, Map, Users, KeyRound, Navigation, Phone, LocateFixed, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Patient, Hospital } from '../types';

// Fix leaflet icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Dashboard Home ---
export const Dashboard = () => {
  const { user, getAllUsers, logActivity } = useAuth();
  const navigate = useNavigate();
  const [quickPatientId, setQuickPatientId] = useState('MQR-2026-12345');
  const [quickOtp, setQuickOtp] = useState('');
  const [quickError, setQuickError] = useState('');
  
  if (user?.role !== 'Patient') {
    const handleHospitalOtpUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      setQuickError('');
      const found = getAllUsers().find(
        (u) => u.id.toLowerCase() === quickPatientId.trim().toLowerCase() && u.role === 'Patient'
      ) as Patient | undefined;

      if (!found) {
        setQuickError('Patient ID not found.');
        return;
      }

      if (!quickOtp.trim()) {
        navigate(`/scan-result/3?id=${found.id}`);
        return;
      }

      try {
        const res = await fetch('/api/scan/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: found.id, otp: quickOtp.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setQuickError(data.error || 'Invalid 6-digit OTP code.');
          return;
        }
        if (user) {
          logActivity(
            user.id,
            'tier_scan',
            `Unlocked Tier 2 records for ${found.name} (${found.id}) via OTP`,
            { accessTier: 'Tier 2', reason: 'OTP Verified Clinical Access' },
            found.id
          );
        }
        navigate(`/scan-result/2?id=${found.id}`);
      } catch {
        setQuickError('Could not verify OTP. Please try again.');
      }
    };

    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e293b] rounded-[16px] p-8 text-white relative overflow-hidden shadow-md">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-[#3B82F6] text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider shadow-sm">
              <ShieldCheck size={14} /> {(user as Hospital).verified ? 'Verified Hospital' : 'Pending Verification'}
            </div>
            <div className="text-gray-300 font-mono text-xs bg-white/10 px-2 py-1 rounded-md">ID: {user?.id}</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}</h1>
          <p className="text-gray-300 max-w-2xl text-sm leading-relaxed">Access patient records securely. Ask the patient for their 6-digit OTP to unlock full Tier-2 medical records.</p>
        </div>

        {/* Direct Patient OTP Unlock Box on Hospital Dashboard */}
        <div className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[44px] h-[44px] bg-[#F59E0B]/10 rounded-xl flex items-center justify-center text-[#F59E0B]">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Enter Patient OTP to Unlock Medical Vault</h2>
              <p className="text-xs text-gray-500">Enter the Patient's MedQR+ ID and the 6-digit OTP they generated on their QR Pass screen.</p>
            </div>
          </div>

          {quickError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold">
              {quickError}
            </div>
          )}

          <form onSubmit={handleHospitalOtpUnlock} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Patient ID</label>
              <input
                type="text"
                value={quickPatientId}
                onChange={(e) => setQuickPatientId(e.target.value)}
                placeholder="e.g. MQR-2026-12345"
                required
                className="w-full border border-gray-200 rounded-[10px] px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">6-Digit Patient OTP</label>
              <input
                type="text"
                value={quickOtp}
                onChange={(e) => setQuickOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="w-full border border-gray-200 rounded-[10px] px-4 py-2.5 font-mono text-sm tracking-widest focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <button
              type="submit"
              className="bg-[#10B981] hover:bg-[#059669] text-white px-6 py-2.5 rounded-[10px] text-sm font-bold shadow-sm transition-colors"
            >
              {quickOtp.trim() ? 'Verify OTP & Unlock Vault' : 'Open Emergency View (Tier 3)'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
            <div className="w-[44px] h-[44px] bg-[#64748B]/10 rounded-xl flex items-center justify-center text-[#64748B] mb-5"><Scan size={22} /></div>
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">Scanner</h3>
            <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">Scan a patient's QR code or enter their OTP to access their medical records.</p>
            <Link to="/dashboard/scanner" className="text-[#64748B] font-bold text-[13px] flex items-center gap-1 group">Open Scanner <ArrowUpRight size={16} /></Link>
          </div>
          <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
            <div className="w-[44px] h-[44px] bg-[#10B981]/10 rounded-xl flex items-center justify-center text-[#10B981] mb-5"><Users size={22} /></div>
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">Patients Accessed</h3>
            <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">View a list of patients you have recently accessed.</p>
            <Link to="/dashboard/patients" className="text-[#10B981] font-bold text-[13px] flex items-center gap-1 group">View Patients <ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </div>
    );
  }

  const patient = user as Patient;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e293b] rounded-[16px] p-8 text-white relative overflow-hidden shadow-md">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#10B981] text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider shadow-sm">
              <ShieldCheck size={14} /> Verified Patient Identity
            </div>
            <div className="text-gray-300 font-mono text-xs bg-white/10 px-2 py-1 rounded-md">ID: {patient.id}</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/qr" className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-[10px] text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
              <QrCode size={16} /> Show My QR Pass
            </Link>
            <Link to="/dashboard/scanner" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-[10px] text-sm font-bold flex items-center gap-2 transition-colors">
              <Scan size={16} /> Open Scanner
            </Link>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Welcome back, {patient.name.split(' ')[0]}</h1>
        <p className="text-gray-300 max-w-2xl text-sm leading-relaxed">Your MEDQR+ pass is active and securely locked under 3-tier encryption. Only authorized medical personnel can access your full records.</p>
      </div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Blood Group */}
        <div className="bg-white p-5 rounded-[16px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider">BLOOD GROUP</div>
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><Heart size={16} /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{patient.bloodGroup || 'N/A'}</div>
            {!patient.bloodGroup ? <Link to="/dashboard/profile" className="text-[13px] text-[#10B981] font-bold">+ Set in Profile</Link> : <span className="text-[13px] text-gray-400">Verified</span>}
          </div>
        </div>
        
        {/* Allergies */}
        <div className="bg-white p-5 rounded-[16px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider">KNOWN ALLERGIES</div>
            <div className="w-8 h-8 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center"><Info size={16} /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{patient.allergies?.length || 0} Flagged</div>
            {patient.allergies?.length === 0 ? <Link to="/dashboard/profile" className="text-[13px] text-[#10B981] font-bold">+ Add in Profile</Link> : <span className="text-[13px] text-gray-400">Critical alerts</span>}
          </div>
        </div>

        {/* Upcoming Visit */}
        <div className="bg-white p-5 rounded-[16px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider">UPCOMING VISIT</div>
            <div className="w-8 h-8 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center"><Calendar size={16} /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">None Scheduled</div>
            <div className="text-[13px] text-gray-400 font-medium">No upcoming appointments</div>
          </div>
        </div>

        {/* Active Medications */}
        <div className="bg-white p-5 rounded-[16px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider">ACTIVE MEDICATIONS</div>
            <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center"><Activity size={16} /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{patient.currentMedications?.length || 0} Active Rx</div>
            {patient.currentMedications?.length === 0 ? <Link to="/dashboard/profile" className="text-[13px] text-[#10B981] font-bold">+ Add in Profile</Link> : <span className="text-[13px] text-gray-400">Maintained list</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Patient Management Tools</h2>
              <div className="text-[13px] text-gray-500 font-medium mt-1">Single unified patient portal</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* My Profile */}
            <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
              <div className="flex justify-between items-start mb-5">
                <div className="w-[44px] h-[44px] bg-[#1e293b]/10 rounded-xl flex items-center justify-center text-[#1e293b]">
                  <User size={22} />
                </div>
                {!patient.bloodGroup ? (
                  <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">SETUP NEEDED</div>
                ) : (
                  <div className="bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">CONFIGURED</div>
                )}
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1">My Profile</h3>
              <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">Complete your health vitals & emergency contacts to secure your pass.</p>
              <Link to="/dashboard/profile" className="text-[#1e293b] font-bold text-[13px] flex items-center gap-1 group">
                Open My Profile <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* My QR Code */}
            <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
              <div className="flex justify-between items-start mb-5">
                <div className="w-[44px] h-[44px] bg-[#10B981]/10 rounded-xl flex items-center justify-center text-[#10B981]">
                  <QrCode size={22} />
                </div>
                <div className="bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">ACTIVE PASS</div>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1">My QR Code</h3>
              <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">View, download & share your encrypted 3-tier medical pass.</p>
              <Link to="/dashboard/qr" className="text-[#10B981] font-bold text-[13px] flex items-center gap-1 group">
                Open My QR Code <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* My Medical Records */}
            <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
              <div className="flex justify-between items-start mb-5">
                <div className="w-[44px] h-[44px] bg-[#3B82F6]/10 rounded-xl flex items-center justify-center text-[#3B82F6]">
                  <FileText size={22} />
                </div>
                <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">{patient.medicalRecords?.length || 0} FILES</div>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1">Medical Records</h3>
              <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">Vault is securely managing your prescriptions, labs, and imaging.</p>
              <Link to="/dashboard/records" className="text-[#3B82F6] font-bold text-[13px] flex items-center gap-1 group">
                Open Records <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* AI Assistant */}
            <div className="bg-white p-[24px] rounded-[16px] shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100">
              <div className="flex justify-between items-start mb-5">
                <div className="w-[44px] h-[44px] bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center text-[#8B5CF6]">
                  <Bot size={22} />
                </div>
                <div className="bg-[#8B5CF6]/10 text-[#8B5CF6] px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">BETA</div>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1">AI Health Coach</h3>
              <p className="text-[13px] text-gray-500 mb-5 flex-1 leading-relaxed">Ask questions about your health data securely with AI.</p>
              <Link to="/dashboard/ai" className="text-[#8B5CF6] font-bold text-[13px] flex items-center gap-1 group">
                Open Assistant <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Activity Feed Column */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Recent Activity</h2>
              <div className="text-[13px] text-gray-500 font-medium mt-1">Audit log of your account</div>
            </div>
          </div>
          
          <div className="bg-white rounded-[16px] shadow-sm p-3 flex flex-col max-h-[420px] overflow-y-auto">
            {patient.activityLog?.length > 0 ? patient.activityLog.map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.type === 'record_added' ? 'bg-[#3B82F6]' : 
                  log.type === 'tier_scan' ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-gray-900 truncate capitalize">{log.type.replace('_', ' ')}</div>
                  <div className="text-[11px] text-gray-500 truncate">{log.details}</div>
                </div>
                <div className="text-[11px] text-gray-400 font-medium shrink-0">
                  {new Date(log.date).toLocaleDateString()}
                </div>
              </div>
            )) : (
              <div className="p-4 text-center text-sm text-gray-500">No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Profile ---
export const Profile = () => {
  const { user, updateUser, logActivity } = useAuth();
  const [formData, setFormData] = useState<any>(user || {});
  const [isSaved, setIsSaved] = useState(false);

  if (!user) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArrayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value.split(',').map(s => s.trim()).filter(s => s) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(formData as any);
    logActivity(user.id, 'profile_updated', 'Updated profile information.');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-[44px] h-[44px] bg-[#1e293b]/10 rounded-xl flex items-center justify-center text-[#1e293b]">
          <User size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
          <p className="text-sm text-gray-500">Update your personal and medical details.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100">
        {isSaved && <div className="mb-6 p-3 bg-[#10B981]/10 text-[#10B981] rounded-lg text-sm font-bold flex items-center justify-center">Profile saved successfully!</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Full Name</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Email Address</label>
              <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]" required />
            </div>
            {user.role === 'Patient' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Blood Group</label>
                  <select name="bloodGroup" value={formData.bloodGroup || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]">
                    <option value="">Select...</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Allergies (comma separated)</label>
                  <input type="text" name="allergies" value={formData.allergies?.join(', ') || ''} onChange={handleArrayChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]" placeholder="Peanuts, Penicillin" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Active Medications (comma separated)</label>
                  <input type="text" name="currentMedications" value={formData.currentMedications?.join(', ') || ''} onChange={handleArrayChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Chronic Conditions (comma separated)</label>
                  <input type="text" name="chronicConditions" value={formData.chronicConditions?.join(', ') || ''} onChange={handleArrayChange} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#10B981]" />
                </div>
              </>
            )}
          </div>
          <button type="submit" className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-6 py-3 rounded-lg text-sm font-bold shadow-sm transition-colors w-full md:w-auto">
            Save Profile Changes
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Medical Records ---
export const MedicalRecords = () => {
  const { user, addMedicalRecord, deleteMedicalRecord } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<any>({ type: 'prescription', title: '', date: new Date().toISOString().split('T')[0], doctor: '', hospital: '', summary: '' });

  if (user?.role !== 'Patient') return null;
  const patient = user as Patient;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMedicalRecord(user.id, { ...newRecord, tags: [], details: '' });
    setIsModalOpen(false);
    setNewRecord({ type: 'prescription', title: '', date: new Date().toISOString().split('T')[0], doctor: '', hospital: '', summary: '' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-[44px] h-[44px] bg-[#3B82F6]/10 rounded-xl flex items-center justify-center text-[#3B82F6]">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Medical Records Vault</h2>
            <p className="text-sm text-gray-500">Manage and view your uploaded records.</p>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
          <Plus size={16} /> Add Record
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[16px] shadow-lg w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">Add New Record</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Type</label>
                  <select name="type" required value={newRecord.type} onChange={e => setNewRecord({...newRecord, type: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none">
                    <option value="prescription">Prescription</option><option value="lab">Lab Result</option><option value="imaging">Imaging</option><option value="consultation">Consultation</option><option value="vaccine">Vaccine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Date</label>
                  <input type="date" required value={newRecord.date} onChange={e => setNewRecord({...newRecord, date: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Title</label>
                <input type="text" required value={newRecord.title} onChange={e => setNewRecord({...newRecord, title: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none" placeholder="e.g. Annual Blood Work" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Doctor</label>
                  <input type="text" required value={newRecord.doctor} onChange={e => setNewRecord({...newRecord, doctor: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Hospital/Clinic</label>
                  <input type="text" required value={newRecord.hospital} onChange={e => setNewRecord({...newRecord, hospital: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Summary</label>
                <input type="text" required value={newRecord.summary} onChange={e => setNewRecord({...newRecord, summary: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#3B82F6] outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                <button type="submit" className="bg-[#3B82F6] text-white px-4 py-2 rounded-lg text-sm font-bold">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {patient.medicalRecords?.length > 0 ? patient.medicalRecords.map(record => (
          <div key={record.id} className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100 flex justify-between items-start hover:shadow-md transition-shadow">
            <div className="flex gap-4">
              <div className="w-[44px] h-[44px] bg-[#3B82F6]/10 rounded-xl flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{record.title}</h3>
                <div className="text-sm text-gray-500 mb-2">{record.date} • {record.hospital} • Dr. {record.doctor}</div>
                <p className="text-sm text-gray-700">{record.summary}</p>
                <div className="mt-3 flex gap-2">
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">{record.type}</span>
                </div>
              </div>
            </div>
            <button onClick={() => deleteMedicalRecord(user.id, record.id)} title="Delete Record" className="text-gray-400 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
          </div>
        )) : (
          <div className="bg-white p-12 text-center rounded-[16px] shadow-sm border border-gray-100 text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <FileText size={32} />
            </div>
            <p className="font-bold text-gray-900 mb-1">Your vault is empty</p>
            <p className="text-sm">Click "Add Record" to start building your medical history.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Patients Accessed & Scan History ---
export const PatientsAccessed = () => {
  const { user } = useAuth();
  const hospital = user?.role === 'Hospital' ? (user as Hospital) : null;
  const accessed = hospital?.patientsAccessed || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Patients Accessed</h2>
      <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Patient Name</th>
              <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Patient ID</th>
              <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tier</th>
              <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {accessed.length > 0 ? accessed.map((entry, idx) => (
              <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-4 font-bold text-gray-900 text-sm">{entry.patientName}</td>
                <td className="p-4 font-mono text-xs text-gray-500">{entry.patientId}</td>
                <td className="p-4 text-sm text-gray-600">{new Date(entry.scanDate).toLocaleString()}</td>
                <td className="p-4">
                  <span className="bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {entry.accessTier}
                  </span>
                </td>
                <td className="p-4">
                  <Link
                    to={`/scan-result/${entry.accessTier.replace('Tier ', '')}?id=${entry.patientId}`}
                    className="text-xs font-bold text-[#10B981] hover:underline"
                  >
                    View Pass →
                  </Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-gray-500">No patients accessed yet in this session.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ScanHistory = () => {
  const { user } = useAuth();
  const logs =
    user?.role === 'Hospital'
      ? (user as Hospital).scanLogs || []
      : user?.role === 'Patient'
      ? (user as Patient).activityLog || []
      : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Scan History &amp; Logs</h2>
      <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm divide-y divide-gray-100">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.id} className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
              <div>
                <div className="font-bold text-gray-900 text-sm capitalize">{log.type.replace('_', ' ')}</div>
                <div className="text-xs text-gray-500 mt-0.5">{log.details}</div>
              </div>
              <div className="text-right">
                {log.accessTier && (
                  <span className="bg-[#3B82F6]/10 text-[#3B82F6] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mr-3">
                    {log.accessTier}
                  </span>
                )}
                <span className="text-xs text-gray-400 font-medium">{new Date(log.date).toLocaleString()}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">
            Detailed chronological log of every QR scan performed will appear here.
          </div>
        )}
      </div>
    </div>
  );
};

// --- AI Assistant ---
export const AIAssistant = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello! I am your AI Health Coach. How can I help you understand your records today?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, userId: user?.id }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { reply: string }) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        setIsTyping(false);
      })
      .catch(() => {
        let reply = "Based on your records, everything looks stable.";
        if (userMessage.toLowerCase().includes('allerg') && user?.role === 'Patient') {
          reply = `You currently have ${(user as Patient).allergies?.length || 0} allergies listed. Please refer to your Profile for specifics.`;
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        setIsTyping(false);
      });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-[44px] h-[44px] bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center text-[#8B5CF6]">
          <Bot size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{user?.role === 'Patient' ? 'Personal Health Coach' : 'Clinical AI Assistant'}</h2>
          <p className="text-sm text-gray-500">Secure, contextual AI assistance.</p>
        </div>
      </div>

      <div className="flex-1 bg-white border border-gray-100 rounded-[16px] shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] p-4 rounded-[16px] text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-[#8B5CF6] text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[75%] p-4 rounded-[16px] bg-white border border-gray-100 text-gray-400 shadow-sm rounded-bl-sm text-sm">
                Assistant is typing...
              </div>
            </div>
          )}
        </div>
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-3">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            placeholder="Type your health question..." 
            className="flex-1 border border-gray-200 rounded-[12px] px-4 py-3 text-sm focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]" 
          />
          <button type="submit" disabled={!input.trim()} className="bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 disabled:hover:bg-[#8B5CF6] text-white px-5 py-3 rounded-[12px] font-bold shadow-sm transition-colors flex items-center justify-center">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Map View (Hospitals, Pharmacies, Blood Banks, Ambulance Services & Diagnostic Centres + Navigation) ---
type FacilityCategory = 'all' | 'hospital' | 'pharmacy' | 'blood_bank' | 'ambulance' | 'diagnostic';

interface MedicalFacility {
  id: string;
  name: string;
  category: Exclude<FacilityCategory, 'all'>;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  hours: string;
  verified: boolean;
  details: string;
}

const CATEGORY_META: Record<
  Exclude<FacilityCategory, 'all'>,
  { label: string; color: string; bgTint: string; badgeText: string; emoji: string }
> = {
  hospital: {
    label: 'Hospital',
    color: '#10B981',
    bgTint: 'bg-[#10B981]/10',
    badgeText: 'text-[#10B981]',
    emoji: '🏥',
  },
  pharmacy: {
    label: 'Pharmacy',
    color: '#3B82F6',
    bgTint: 'bg-[#3B82F6]/10',
    badgeText: 'text-[#3B82F6]',
    emoji: '💊',
  },
  blood_bank: {
    label: 'Blood Bank',
    color: '#EF4444',
    bgTint: 'bg-red-50',
    badgeText: 'text-red-600',
    emoji: '🩸',
  },
  ambulance: {
    label: 'Ambulance Service',
    color: '#F59E0B',
    bgTint: 'bg-[#F59E0B]/10',
    badgeText: 'text-[#F59E0B]',
    emoji: '🚑',
  },
  diagnostic: {
    label: 'Diagnostic Centre',
    color: '#8B5CF6',
    bgTint: 'bg-[#8B5CF6]/10',
    badgeText: 'text-[#8B5CF6]',
    emoji: '🔬',
  },
};

const createCategoryIcon = (category: Exclude<FacilityCategory, 'all'>, isSelected: boolean) => {
  const meta = CATEGORY_META[category];
  const size = isSelected ? 42 : 34;
  return L.divIcon({
    className: 'custom-facility-marker',
    html: `<div style="
      width:${size}px;
      height:${size}px;
      background:${meta.color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 3px 10px rgba(0,0,0,0.28);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:${isSelected ? '19px' : '15px'};
      transform:${isSelected ? 'scale(1.1)' : 'scale(1)'};
      transition:all 0.2s ease;
    ">${meta.emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const buildNearbyFacilities = (baseLat: number, baseLng: number): MedicalFacility[] => [
  // Hospitals
  {
    id: 'fac-hosp-1',
    name: 'City General Multi-Specialty Hospital',
    category: 'hospital',
    lat: baseLat + 0.0065,
    lng: baseLng + 0.0052,
    address: '123 Health Avenue, Central Medical District',
    phone: '+91 98220 11101',
    hours: '24/7 Emergency & ICU',
    verified: true,
    details: 'Trauma Center • ICU • Cardiology • MedQR+ Tier-2 Partner',
  },
  {
    id: 'fac-hosp-2',
    name: 'Apex Care & Trauma Hospital',
    category: 'hospital',
    lat: baseLat - 0.0082,
    lng: baseLng + 0.0075,
    address: '45 Ring Road, East Sector',
    phone: '+91 98220 11102',
    hours: '24/7 Open',
    verified: true,
    details: 'Emergency Triage • Maternity • Orthopedics',
  },
  {
    id: 'fac-hosp-3',
    name: 'Sunrise Lifeline Hospital',
    category: 'hospital',
    lat: baseLat + 0.011,
    lng: baseLng - 0.009,
    address: 'Plot 18, Civil Lines Road',
    phone: '+91 98220 11103',
    hours: '24/7 Open',
    verified: true,
    details: 'General Surgery • Pediatrics • Neurology',
  },

  // Pharmacies
  {
    id: 'fac-pharm-1',
    name: 'MedPlus 24x7 Chemist & Druggist',
    category: 'pharmacy',
    lat: baseLat + 0.0032,
    lng: baseLng - 0.0041,
    address: 'Shop 4, Main Market Square',
    phone: '+91 98220 22201',
    hours: '24/7 Open',
    verified: true,
    details: 'Prescription Drugs • Insulin Cold Storage • Home Delivery',
  },
  {
    id: 'fac-pharm-2',
    name: 'Apollo Emergency Pharmacy',
    category: 'pharmacy',
    lat: baseLat - 0.0048,
    lng: baseLng - 0.0035,
    address: 'Near Station Road Crossing',
    phone: '+91 98220 22202',
    hours: '24/7 Open',
    verified: true,
    details: 'Life-Saving Drugs • Surgical Supplies • Nebulizers',
  },
  {
    id: 'fac-pharm-3',
    name: 'Wellness Forever Pharmacy',
    category: 'pharmacy',
    lat: baseLat + 0.0078,
    lng: baseLng + 0.0098,
    address: 'Green Park Arcade, Ground Floor',
    phone: '+91 98220 22203',
    hours: '7:00 AM – 11:30 PM',
    verified: true,
    details: 'Generic & Branded Medicines • Vaccinations',
  },

  // Blood Banks
  {
    id: 'fac-blood-1',
    name: 'Red Cross Regional Blood Bank',
    category: 'blood_bank',
    lat: baseLat - 0.0029,
    lng: baseLng + 0.0064,
    address: 'Red Cross Bhavan, Hospital Road',
    phone: '+91 98220 33301',
    hours: '24/7 Blood & Platelets',
    verified: true,
    details: 'O+, O-, A+, B+, AB+ Available • Whole Blood, Plasma & Platelets',
  },
  {
    id: 'fac-blood-2',
    name: 'Lifeline Voluntary Blood Centre',
    category: 'blood_bank',
    lat: baseLat + 0.0094,
    lng: baseLng - 0.0028,
    address: '2nd Floor, Medical Trust Complex',
    phone: '+91 98220 33302',
    hours: '24/7 Emergency Issue',
    verified: true,
    details: 'Rare Rh-Negative Stock • Component Separation Unit',
  },

  // Ambulance Services
  {
    id: 'fac-amb-1',
    name: '108 Rapid Response ALS Ambulance Hub',
    category: 'ambulance',
    lat: baseLat + 0.0018,
    lng: baseLng + 0.0025,
    address: 'Central Emergency Dispatch Station',
    phone: '108',
    hours: '24/7 Instant Dispatch (< 8 mins)',
    verified: true,
    details: 'Advanced Life Support (ALS) • Ventilator • Defibrillator & Paramedic',
  },
  {
    id: 'fac-amb-2',
    name: 'MedQR+ Cardiac & ICU Air/Road Ambulance',
    category: 'ambulance',
    lat: baseLat - 0.0062,
    lng: baseLng - 0.0078,
    address: 'Highway Trauma Outpost',
    phone: '+91 98220 44402',
    hours: '24/7 Rapid Response',
    verified: true,
    details: 'Cardiac Monitor • Oxygen Support • GPS Tracked Fleet',
  },

  // Diagnostic Centres
  {
    id: 'fac-diag-1',
    name: 'Dr. Lal PathLabs & Advanced Diagnostics',
    category: 'diagnostic',
    lat: baseLat - 0.0055,
    lng: baseLng + 0.0019,
    address: '12 Metro Plaza, Opp. City Park',
    phone: '+91 98220 55501',
    hours: '6:30 AM – 10:00 PM',
    verified: true,
    details: 'Complete Blood Count (CBC) • RT-PCR • Lipid & Thyroid Panels',
  },
  {
    id: 'fac-diag-2',
    name: 'SRL MRI, CT Scan & Digital X-Ray Centre',
    category: 'diagnostic',
    lat: baseLat + 0.0049,
    lng: baseLng - 0.0084,
    address: '88 Residency Road, Medical Square',
    phone: '+91 98220 55502',
    hours: '24/7 Emergency Imaging',
    verified: true,
    details: '3T MRI • 128-Slice CT Scan • Ultrasound • 2D Echo & ECG',
  },
];

// Calculate distance in km using Haversine formula
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MapController: React.FC<{
  center: [number, number];
  destination: MedicalFacility | null;
}> = ({ center, destination }) => {
  const map = useMap();
  useEffect(() => {
    if (destination) {
      const bounds = L.latLngBounds([center, [destination.lat, destination.lng]]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else {
      map.setView(center, 14);
    }
  }, [center, destination, map]);
  return null;
};

export const MapView = () => {
  // Default coordinates (Solapur / Maharashtra center, automatically updated via browser GPS)
  const [userPos, setUserPos] = useState<[number, number]>([17.6599, 75.9064]);
  const [locating, setLocating] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<FacilityCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facilities, setFacilities] = useState<MedicalFacility[]>(() =>
    buildNearbyFacilities(17.6599, 75.9064)
  );
  const [activeDest, setActiveDest] = useState<MedicalFacility | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: string;
    durationMin: number;
    steps: string[];
  } | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        setFacilities(buildNearbyFacilities(coords[0], coords[1]));
        setActiveDest(null);
        setRouteCoords([]);
        setRouteSummary(null);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const startNavigation = (facility: MedicalFacility) => {
    setActiveDest(facility);
    const straightDist = getDistanceKm(userPos[0], userPos[1], facility.lat, facility.lng);
    const fallbackEta = Math.max(2, Math.round((straightDist / 30) * 60));

    // Immediately show straight-line path while fetching real road geometry from OSRM
    setRouteCoords([
      [userPos[0], userPos[1]],
      [facility.lat, facility.lng],
    ]);
    setRouteSummary({
      distanceKm: straightDist.toFixed(2),
      durationMin: fallbackEta,
      steps: [
        `Head towards ${facility.address}`,
        `Proceed ${straightDist.toFixed(1)} km to ${facility.name}`,
      ],
    });

    // Fetch real road turn-by-turn route from OSRM public routing service
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${facility.lng},${facility.lat}?overview=full&geometries=geojson&steps=true`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates) {
          const latLngs: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setRouteCoords(latLngs);
          const distKm = (route.distance / 1000).toFixed(2);
          const durMin = Math.max(1, Math.round(route.duration / 60));
          const rawSteps: string[] =
            route.legs?.[0]?.steps
              ?.map((s: any) => s.maneuver?.instruction || s.name)
              .filter((s: string) => Boolean(s))
              .slice(0, 4) || [];

          setRouteSummary({
            distanceKm: distKm,
            durationMin: durMin,
            steps:
              rawSteps.length > 0
                ? rawSteps
                : [`Follow highlighted road route (${distKm} km) to ${facility.name}`],
          });
        }
      })
      .catch(() => {
        // Keep straight-line fallback if offline
      });
  };

  const clearNavigation = () => {
    setActiveDest(null);
    setRouteCoords([]);
    setRouteSummary(null);
  };

  const filteredFacilities = facilities
    .filter((f) => (selectedCategory === 'all' ? true : f.category === selectedCategory))
    .filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .map((f) => ({
      ...f,
      distanceKm: getDistanceKm(userPos[0], userPos[1], f.lat, f.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const filterButtons: { id: FacilityCategory; label: string; emoji: string }[] = [
    { id: 'all', label: 'All Services', emoji: '📍' },
    { id: 'hospital', label: 'Hospitals', emoji: '🏥' },
    { id: 'pharmacy', label: 'Pharmacies', emoji: '💊' },
    { id: 'blood_bank', label: 'Blood Banks', emoji: '🩸' },
    { id: 'ambulance', label: 'Ambulance', emoji: '🚑' },
    { id: 'diagnostic', label: 'Diagnostics', emoji: '🔬' },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-[44px] h-[44px] bg-[#F59E0B]/10 rounded-xl flex items-center justify-center text-[#F59E0B]">
            <Map size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Emergency &amp; Medical Support Map</h2>
            <p className="text-sm text-gray-500">
              Nearby Hospitals, Pharmacies, Blood Banks, Ambulance Services &amp; Diagnostic Centres with live route navigation.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={detectLocation}
          disabled={locating}
          className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <LocateFixed size={16} className={locating ? 'animate-spin text-[#10B981]' : 'text-[#10B981]'} />
          {locating ? 'Locating GPS...' : 'Use My Live Location'}
        </button>
      </div>

      {/* Category Filter Pills & Search Bar */}
      <div className="bg-white p-4 rounded-[16px] shadow-sm border border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => {
            const active = selectedCategory === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setSelectedCategory(btn.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-[#1e293b] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{btn.emoji}</span>
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hospital, blood group, MRI..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#10B981]"
          />
        </div>
      </div>

      {/* Active Turn-by-Turn Navigation Banner */}
      {activeDest && routeSummary && (
        <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] text-white p-5 rounded-[16px] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#10B981] text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Navigation size={11} /> Live Route Active
              </span>
              <span className="text-xs text-gray-300 font-mono">
                {routeSummary.distanceKm} km • ~{routeSummary.durationMin} mins drive
              </span>
            </div>
            <h3 className="text-lg font-bold">
              Navigating to: {activeDest.name} ({CATEGORY_META[activeDest.category].label})
            </h3>
            <p className="text-xs text-gray-300">
              {activeDest.address} • {activeDest.hours}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={`tel:${activeDest.phone}`}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Phone size={14} /> Call ({activeDest.phone})
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${activeDest.lat},${activeDest.lng}&travelmode=driving`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Navigation size={14} /> Start Google Maps GPS
            </a>
            <button
              type="button"
              onClick={clearNavigation}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors"
            >
              End Route
            </button>
          </div>
        </div>
      )}

      {/* Main Split View: Nearby Directory List + Interactive Leaflet Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[560px]">
        {/* Left Column: Scrollable Facility Cards */}
        <div className="lg:col-span-1 bg-white border border-gray-100 rounded-[16px] shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/60">
            <span className="font-bold text-xs uppercase tracking-wider text-gray-500">
              Nearby Services ({filteredFacilities.length})
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Sorted by distance</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-3 space-y-2">
            {filteredFacilities.map((fac) => {
              const meta = CATEGORY_META[fac.category];
              const isSelected = activeDest?.id === fac.id;
              return (
                <div
                  key={fac.id}
                  onClick={() => startNavigation(fac)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#10B981] bg-[#10B981]/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.bgTint} ${meta.badgeText}`}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-700">
                      {fac.distanceKm.toFixed(1)} km
                    </span>
                  </div>

                  <h4 className="font-bold text-gray-900 text-sm mb-1">{fac.name}</h4>
                  <p className="text-xs text-gray-500 mb-2">{fac.details}</p>
                  <div className="text-[11px] text-gray-400 mb-3">
                    📍 {fac.address} • 🕒 {fac.hours}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => startNavigation(fac)}
                      className="flex-1 bg-[#1e293b] hover:bg-[#0f172a] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Navigation size={13} /> Show Route
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${fac.lat},${fac.lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#10B981] hover:bg-[#059669] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Open Turn-by-Turn GPS Navigation"
                    >
                      GPS ↗
                    </a>
                    <a
                      href={`tel:${fac.phone}`}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center transition-colors"
                      title={`Call ${fac.phone}`}
                    >
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Leaflet Map with Route Polyline */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[16px] shadow-sm overflow-hidden relative z-0">
          <MapContainer center={userPos} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController center={userPos} destination={activeDest} />

            {/* User's Current Location Marker */}
            <CircleMarker
              center={userPos}
              radius={10}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#2563EB',
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="font-bold text-gray-900 text-sm">📍 Your Current Location</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Click any nearby facility to start turn-by-turn navigation.
                </div>
              </Popup>
            </CircleMarker>

            {/* Active Navigation Route Polyline */}
            {routeCoords.length > 1 && (
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: '#2563EB',
                  weight: 5,
                  opacity: 0.85,
                  dashArray: '1, 0',
                }}
              />
            )}

            {/* Nearby Facility Markers */}
            {filteredFacilities.map((fac) => {
              const meta = CATEGORY_META[fac.category];
              const isSelected = activeDest?.id === fac.id;
              return (
                <Marker
                  key={fac.id}
                  position={[fac.lat, fac.lng]}
                  icon={createCategoryIcon(fac.category, isSelected)}
                >
                  <Popup>
                    <div className="min-w-[210px] space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {meta.emoji} {meta.label} • {fac.distanceKm.toFixed(1)} km away
                      </div>
                      <div className="font-bold text-gray-900 text-sm">{fac.name}</div>
                      <div className="text-xs text-gray-600">{fac.details}</div>
                      <div className="text-[11px] text-gray-500">
                        📍 {fac.address}
                        <br />🕒 {fac.hours} • 📞 {fac.phone}
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startNavigation(fac)}
                          className="flex-1 bg-[#1e293b] text-white px-2.5 py-1.5 rounded-md text-xs font-bold"
                        >
                          Show Route
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${fac.lat},${fac.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#10B981] !text-white px-2.5 py-1.5 rounded-md text-xs font-bold no-underline"
                        >
                          Start GPS ↗
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
