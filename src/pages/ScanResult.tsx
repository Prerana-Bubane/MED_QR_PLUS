import React, { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import type { Patient } from '../types';
import { ShieldAlert, ShieldCheck, Lock, AlertTriangle, ArrowLeft, KeyRound, RefreshCw, CheckCircle2, FileText, Activity, Shield } from 'lucide-react';

export const ScanResult = () => {
  const { tier } = useParams<{ tier: string }>();
  const location = useLocation();
  const { user, logActivity } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [otp, setOtp] = useState('');
  const [otpNotice, setOtpNotice] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [accessLevel, setAccessLevel] = useState<string>('3');

  const queryParams = new URLSearchParams(location.search);
  const patientId = queryParams.get('id') || 'MQR-2026-12345';
  const queryVaultToken = queryParams.get('vaultToken') || '';

  const getVaultTokenKey = (id: string) => `medqr_vault_token_${id.toLowerCase()}`;

  const fetchPatientRecord = (overrideVaultToken?: string) => {
    setLoading(true);
    setNotFound(false);

    const storedVaultToken =
      overrideVaultToken ||
      queryVaultToken ||
      sessionStorage.getItem(getVaultTokenKey(patientId)) ||
      '';

    const headers: Record<string, string> = {};
    if (storedVaultToken) {
      headers['x-vault-token'] = storedVaultToken;
    }

    apiFetch(`/api/users/${encodeURIComponent(patientId)}`, {
      headers,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { user?: Patient; tierLocked?: boolean; accessTier?: string }) => {
        if (data.user && data.user.role === 'Patient') {
          setPatient(data.user);
          // Server strictly decides whether Tier 2 is unlocked; never allow URL /scan-result/2 to bypass server lock
          if (data.tierLocked === false && tier !== '3') {
            setAccessLevel('2');
          } else {
            setAccessLevel('3');
          }
          setLoading(false);
        } else {
          setNotFound(true);
          setLoading(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (queryVaultToken) {
      sessionStorage.setItem(getVaultTokenKey(patientId), queryVaultToken);
    }
    fetchPatientRecord(queryVaultToken || undefined);
  }, [patientId, tier, queryVaultToken]);

  if (loading && !patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center mb-4 animate-pulse">
          <Shield size={24} />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Loading MedQR+ Medical Report...</h2>
        <p className="text-sm text-gray-500 mt-1">Decrypting patient pass {patientId}</p>
      </div>
    );
  }

  if (notFound || !patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Patient Record Not Accessible</h2>
          <p className="text-sm text-gray-500 mb-6">
            Could not locate or authorize access to MedQR+ ID <span className="font-mono font-bold text-gray-800">{patientId}</span>. Please ensure you are signed in with an authorized account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center bg-[#1e293b] text-white px-6 py-2.5 rounded-lg text-sm font-bold"
          >
            Sign In to MedQR+
          </Link>
        </div>
      </div>
    );
  }

  const handleRequestOtp = () => {
    setOtpError('');
    setOtpNotice('');
    setIsRequesting(true);

    apiFetch('/api/scan/request-otp', {
      method: 'POST',
      body: JSON.stringify({
        patientId: patient.id,
        requestedBy: user?.name || 'Hospital Provider',
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to request OTP');
        }
        return data as { message?: string };
      })
      .then((data) => {
        setOtpNotice(
          data.message || 'New 6-digit OTP generated. Ask the patient to share the code from their QR Pass.'
        );
        setIsRequesting(false);
      })
      .catch((err: Error) => {
        setOtpError(err.message || 'Could not request OTP.');
        setIsRequesting(false);
      });
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    apiFetch('/api/scan/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ patientId: patient.id, otp }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.vaultToken) {
          throw new Error(data.error || 'Invalid OTP code');
        }
        return data as { vaultToken: string };
      })
      .then((data) => {
        sessionStorage.setItem(getVaultTokenKey(patient.id), data.vaultToken);
        fetchPatientRecord(data.vaultToken);
        setAccessLevel('2');
        if (user?.role === 'Hospital') {
          logActivity(
            user.id,
            'tier_scan',
            `Unlocked Tier 2 full records for ${patient.name} (${patient.id}) via OTP`,
            { accessTier: 'Tier 2', reason: 'OTP Verified Clinical Access' },
            patient.id
          );
        }
      })
      .catch((err: Error) => {
        setOtpError(err.message || 'Invalid 6-digit OTP code. Please try again.');
      });
  };

  const handleLockVault = () => {
    sessionStorage.removeItem(getVaultTokenKey(patient.id));
    setAccessLevel('3');
    setPatient((prev) => (prev ? { ...prev, medicalRecords: [] } : prev));
  };

  const isFullAccess = accessLevel === '2' || accessLevel === '1';

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 md:py-10">
      <div className="max-w-4xl mx-auto space-y-6 relative">
        <div className="flex items-center justify-between">
          <Link
            to={user ? '/dashboard' : '/'}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={16} /> {user ? 'Back to Dashboard' : 'MedQR+ Home'}
          </Link>
          {isFullAccess && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLockVault}
                className="text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <Lock size={13} /> Lock Vault (Return to Tier 3)
              </button>
            </div>
          )}
        </div>

        {/* Status Banner */}
        <div
          className={`rounded-[16px] p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
            isFullAccess ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl shrink-0">
              {isFullAccess ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {isFullAccess ? 'MedQR+ Verified Medical Report (Tier 2)' : 'Tier 3 Emergency Medical Summary'}
              </h1>
              <p className="text-white/90 text-sm font-medium">
                {isFullAccess
                  ? 'Full medical report, vitals, medications & records unlocked.'
                  : 'Restricted emergency view — Enter Patient OTP below to unlock full vault.'}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs uppercase tracking-widest font-bold text-white/70 mb-1">Patient ID</div>
            <div className="font-mono text-base md:text-lg font-bold bg-black/15 px-3 py-1 rounded-lg inline-block">
              {patient.id}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Core Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 uppercase tracking-widest text-[11px] mb-4">Patient Profile</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase mb-1">Full Name</div>
                  <div className="font-bold text-gray-900 text-lg">{patient.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">DOB</div>
                    <div className="font-medium text-gray-900">{patient.dob || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">Gender</div>
                    <div className="font-medium text-gray-900">{patient.gender || 'Not set'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">Phone</div>
                    <div className="font-medium text-gray-900 text-sm">{patient.phone || '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">Email</div>
                    <div className="font-medium text-gray-900 text-sm truncate">{patient.email || '--'}</div>
                  </div>
                </div>
                {patient.address && (
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">Address</div>
                    <div className="font-medium text-gray-900 text-sm">{patient.address}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-red-50 rounded-[16px] border border-red-100 p-6">
              <h3 className="font-bold text-red-800 uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2">
                <AlertTriangle size={14} /> Critical Medical Info
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-red-600 font-bold uppercase mb-1">Blood Group</div>
                  <div className="font-bold text-red-900 text-2xl">{patient.bloodGroup || 'UNKNOWN'}</div>
                </div>
                <div>
                  <div className="text-xs text-red-600 font-bold uppercase mb-1">Known Allergies</div>
                  <div className="font-bold text-red-900">
                    {patient.allergies?.length > 0 ? patient.allergies.join(', ') : 'None reported'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-red-600 font-bold uppercase mb-1">Active Medications</div>
                  <div className="font-bold text-red-900">
                    {patient.currentMedications?.length > 0 ? patient.currentMedications.join(', ') : 'None listed'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-red-600 font-bold uppercase mb-1">Chronic Conditions</div>
                  <div className="font-bold text-red-900">
                    {patient.chronicConditions?.length > 0 ? patient.chronicConditions.join(', ') : 'None listed'}
                  </div>
                </div>
                {patient.emergencyContact?.name && (
                  <div>
                    <div className="text-xs text-red-600 font-bold uppercase mb-1">Emergency Contact</div>
                    <div className="font-bold text-red-900">{patient.emergencyContact.name}</div>
                    <div className="text-sm text-red-700">{patient.emergencyContact.phone}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Medical Records Vault */}
          <div className="lg:col-span-2 space-y-6">
            {!isFullAccess && (
              <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-amber-50 text-[#F59E0B] rounded-full flex items-center justify-center mb-4">
                  <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Vault Locked (Tier 3 Restricted View)</h2>
                <p className="text-gray-500 mb-6 max-w-md text-sm">
                  Enter the <strong>6-Digit OTP</strong> shared by the patient (from their <em>My QR Code</em> screen), or click <strong>Request Patient OTP</strong> to generate a new code on their pass.
                </p>

                <div className="w-full max-w-md mx-auto space-y-4">
                  {otpNotice && (
                    <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-[14px] p-3.5 text-left text-xs font-bold text-[#059669] flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>{otpNotice}</span>
                    </div>
                  )}

                  <form
                    onSubmit={handleOtpSubmit}
                    className="bg-gray-50 p-6 rounded-[16px] border border-gray-200 w-full text-left"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <KeyRound size={14} className="text-[#10B981]" /> Enter Patient's 6-Digit OTP
                      </label>
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={isRequesting}
                        className="text-xs font-bold text-[#3B82F6] hover:underline flex items-center gap-1"
                      >
                        <RefreshCw size={12} className={isRequesting ? 'animate-spin' : ''} />
                        Request Patient OTP
                      </button>
                    </div>

                    {otpError && (
                      <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold">
                        {otpError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-[10px] px-4 py-2.5 font-mono text-center text-lg tracking-[0.4em] focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none bg-white"
                        placeholder="••••••"
                        maxLength={6}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-[10px] text-sm font-bold transition-colors shrink-0"
                      >
                        Verify &amp; Unlock
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {isFullAccess && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={20} className="text-[#3B82F6]" /> Patient Medical Records ({patient.medicalRecords?.length || 0})
                  </h2>
                </div>

                {patient.medicalRecords?.length > 0 ? (
                  patient.medicalRecords.map((record) => (
                    <div
                      key={record.id}
                      className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{record.title}</h3>
                        <span className="bg-[#3B82F6]/10 text-[#3B82F6] px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                          {record.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        {record.date} • {record.hospital} • Dr. {record.doctor}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-800 font-medium">{record.summary}</p>
                        {record.details && <p className="text-sm text-gray-600 mt-2">{record.details}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 text-center text-gray-500 text-sm">
                    <Activity size={28} className="mx-auto text-gray-400 mb-2" />
                    <div className="font-bold text-gray-800 mb-1">No Uploaded Lab/Prescription Files Yet</div>
                    <p className="text-xs text-gray-500">
                      Patient vitals, blood group ({patient.bloodGroup || 'N/A'}), and allergies are displayed in the Medical Summary card.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
