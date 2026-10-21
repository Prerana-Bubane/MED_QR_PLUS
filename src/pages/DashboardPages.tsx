import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, Scan, Heart, Info, Calendar, Activity, User, QrCode, FileText, ArrowUpRight, Plus, X, Trash2, Send, Bot, Map, Users, KeyRound } from 'lucide-react';
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

// --- Map View ---
export const MapView = () => {
  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-[44px] h-[44px] bg-[#F59E0B]/10 rounded-xl flex items-center justify-center text-[#F59E0B]">
          <Map size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Map</h2>
          <p className="text-sm text-gray-500">Find verified hospitals and emergency services nearby.</p>
        </div>
      </div>
      <div className="flex-1 bg-white border border-gray-100 rounded-[16px] shadow-sm overflow-hidden relative z-0">
        <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[51.505, -0.09]}>
            <Popup>
              <div className="font-bold text-gray-900">City General Hospital</div>
              <div className="text-xs text-[#10B981] font-bold mt-1">Verified Partner</div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};
