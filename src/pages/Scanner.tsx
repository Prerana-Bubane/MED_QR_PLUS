import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scan, ShieldAlert, KeyRound, Upload } from 'lucide-react';
import type { Patient } from '../types';

export const Scanner = () => {
  const [manualId, setManualId] = useState('MQR-2026-12345');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [scanningFile, setScanningFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, getAllUsers, logActivity } = useAuth();

  // Extract Patient ID from either a full QR URL (http://.../scan-result/3?id=MQR-...) or raw ID string
  const extractPatientId = (rawText: string): string => {
    const trimmed = rawText.trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const idParam = url.searchParams.get('id');
        if (idParam) return idParam.trim();
      }
    } catch {
      // Fall through to raw string
    }
    return trimmed;
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {});
        handleScan(decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  const handleScan = async (rawInput: string, providedOtp?: string) => {
    setError('');
    const extractedId = extractPatientId(rawInput);

    const users = getAllUsers();
    let patient = users.find(
      (u) => u.id.toLowerCase() === extractedId.toLowerCase() && u.role === 'Patient'
    ) as Patient | undefined;

    // Also check backend API if not found in local cache
    if (!patient) {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(extractedId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.user && data.user.role === 'Patient') {
            patient = data.user as Patient;
          }
        }
      } catch {
        // Ignore network error
      }
    }

    if (!patient) {
      setError(`Invalid QR code or Patient ID "${extractedId}" not found.`);
      return;
    }

    let tier = '3';

    // If the hospital entered a 6-digit OTP right here, verify it against the backend
    if (providedOtp && providedOtp.trim().length > 0) {
      try {
        const res = await fetch('/api/scan/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: patient.id, otp: providedOtp.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Invalid 6-digit OTP code.');
          return;
        }
        tier = '2';
      } catch {
        setError('Could not verify OTP. Please try again.');
        return;
      }
    } else if (user?.role === 'Patient' && user.id === patient.id) {
      tier = '2'; // patient scanning their own pass
    }

    if (user?.role === 'Hospital') {
      logActivity(
        user.id,
        'tier_scan',
        `Scanned patient ${patient.name} (${patient.id}) — Tier ${tier}`,
        { accessTier: `Tier ${tier}` as any, reason: tier === '2' ? 'OTP Verified Access' : 'Emergency Scan' },
        patient.id
      );
    }

    navigate(`/scan-result/${tier}?id=${encodeURIComponent(patient.id)}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setScanningFile(true);

    try {
      const html5QrCode = new Html5Qrcode('qr-file-reader-hidden');
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      setScanningFile(false);
      handleScan(decodedText, otp);
    } catch {
      setScanningFile(false);
      setError('Could not read a valid QR code from that image. Please upload a clear MedQR+ PNG.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId) handleScan(manualId, otp);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-[44px] h-[44px] bg-[#64748B]/10 rounded-xl flex items-center justify-center text-[#64748B]">
          <Scan size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">QR Scanner &amp; OTP Verification</h2>
          <p className="text-sm text-gray-500">
            Scan via camera, upload a downloaded QR Code PNG, or enter Patient ID + OTP below.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-[16px] text-sm font-bold flex items-center gap-2 mb-6">
          <ShieldAlert size={18} /> {error}
        </div>
      )}

      {/* Hidden element used by Html5Qrcode.scanFile */}
      <div id="qr-file-reader-hidden" className="hidden"></div>

      <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden text-center">
        {/* Upload QR Code PNG Option */}
        <div className="p-6 bg-[#10B981]/5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h3 className="font-bold text-gray-900 text-sm">Have a downloaded MedQR+ PNG file?</h3>
            <p className="text-xs text-gray-500">
              Upload the QR code image file directly to scan and open the patient's record immediately.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanningFile}
            className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-[10px] text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <Upload size={16} />
            {scanningFile ? 'Decoding QR...' : 'Upload QR Image (.PNG)'}
          </button>
        </div>

        {/* Live Camera Scanner */}
        <div className="p-8 border-b border-gray-100">
          <div id="reader" className="mx-auto overflow-hidden rounded-2xl max-w-sm mb-4"></div>
          <p className="text-sm text-gray-500">Position the QR code within the camera frame to scan automatically.</p>
        </div>

        {/* Manual ID & OTP Fallback */}
        <div className="p-8 bg-gray-50 text-left">
          <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-4 text-center">
            Manual Patient ID &amp; 6-Digit OTP Entry
          </h3>
          <form onSubmit={handleManualSubmit} className="max-w-md mx-auto space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Patient MedQR+ ID</label>
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="e.g. MQR-2026-12345"
                required
                className="w-full border border-gray-300 bg-white rounded-[12px] px-4 py-2.5 focus:outline-none focus:border-[#10B981] font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                <KeyRound size={13} className="text-[#10B981]" /> Patient 6-Digit OTP (Optional for Tier 3, Required for Full Tier 2 Vault)
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP shared by patient (or leave blank for Tier 3)"
                maxLength={6}
                className="w-full border border-gray-300 bg-white rounded-[12px] px-4 py-2.5 focus:outline-none focus:border-[#10B981] font-mono text-sm tracking-widest"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white px-5 py-3 rounded-[12px] text-sm font-bold shadow-sm transition-colors"
            >
              {otp.trim() ? 'Verify OTP & Unlock Full Records (Tier 2)' : 'Lookup Patient Pass (Tier 3 View)'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
