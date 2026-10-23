import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Download, Share2, QrCode, KeyRound, RefreshCw, Copy, Check, ExternalLink, Globe, Wifi } from 'lucide-react';

export const QRPass = () => {
  const { user, logActivity } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeOtp, setActiveOtp] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [networkMode, setNetworkMode] = useState<'public' | 'lan'>('public');

  useEffect(() => {
    if (!user || user.role !== 'Patient') return;

    // 1. Ensure current patient & medical records are synced to the backend database
    apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    }).catch(() => {});

    // 2. Fetch active OTP if one exists
    apiFetch(`/api/scan/otp/${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { active: boolean; otp?: string; expiresAt?: number }) => {
        if (data.active && data.otp) {
          setActiveOtp(data.otp);
          setExpiresAt(data.expiresAt || null);
        }
      })
      .catch(() => {});

    // 3. Fetch Public HTTPS URL (for Mobile Data + Wi-Fi) and LAN IP
    const currentPort = window.location.port || '5173';
    const fetchNetworkInfo = () => {
      apiFetch(`/api/network-info?port=${encodeURIComponent(currentPort)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { lanIp?: string | null; publicUrl?: string | null }) => {
          if (data.lanIp) setLanIp(data.lanIp);
          if (data.publicUrl) setPublicUrl(data.publicUrl);
        })
        .catch(() => {});
    };

    fetchNetworkInfo();
    const timer = setTimeout(fetchNetworkInfo, 2500);
    return () => clearTimeout(timer);
  }, [user]);

  if (user?.role !== 'Patient') return null;

  // Build a real, scannable URL that works on BOTH Mobile Data (via public HTTPS tunnel) and Wi-Fi (via Express port 5000)
  const getBaseOrigin = () => {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (networkMode === 'public' && publicUrl) {
        return publicUrl;
      }
      if (lanIp) {
        return `${protocol}//${lanIp}:5000`;
      }
    }
    return window.location.origin;
  };

  const qrScanUrl = `${getBaseOrigin()}/scan-result/3?id=${encodeURIComponent(user.id)}`;

  const generateOtp = () => {
    setGenerating(true);
    apiFetch('/api/scan/request-otp', {
      method: 'POST',
      body: JSON.stringify({ patientId: user.id, requestedBy: 'Patient Self-Generation' }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => apiFetch(`/api/scan/otp/${encodeURIComponent(user.id)}`))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { active: boolean; otp?: string; expiresAt?: number }) => {
        if (data.active && data.otp) {
          setActiveOtp(data.otp);
          setExpiresAt(data.expiresAt || null);
        }
        setGenerating(false);
      })
      .catch(() => {
        setGenerating(false);
      });
  };

  const copyOtp = () => {
    if (!activeOtp) return;
    navigator.clipboard.writeText(activeOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `medqr-pass-${user.id}.png`;
        downloadLink.href = `${pngFile}`;
        downloadLink.click();
        logActivity(user.id, 'profile_updated', 'Downloaded QR Pass');
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-[44px] h-[44px] bg-[#10B981]/10 rounded-xl flex items-center justify-center text-[#10B981]">
          <QrCode size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My QR Code</h2>
          <p className="text-sm text-gray-500">Works on both Mobile Data (4G/5G) and Wi-Fi networks.</p>
        </div>
      </div>

      <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden text-center">
        <div className="bg-[#1e293b] p-6 text-white text-left flex justify-between items-center">
          <div>
            <div className="font-bold text-lg">MEDQR+ Pass</div>
            <div className="text-xs text-gray-400 font-mono">{user.id}</div>
          </div>
          <div className="bg-[#10B981] text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
            <ShieldCheck size={14} /> Active (Mobile + Wi-Fi)
          </div>
        </div>

        <div className="p-8 md:p-10 flex flex-col items-center justify-center bg-gray-50/50">
          {/* Network Mode Selector */}
          {publicUrl && lanIp && (
            <div className="inline-flex bg-gray-200/80 p-1 rounded-xl mb-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => setNetworkMode('public')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  networkMode === 'public' ? 'bg-white text-[#1e293b] shadow-sm' : 'text-gray-600'
                }`}
              >
                <Globe size={14} className="text-[#10B981]" /> Mobile Data &amp; Wi-Fi (Global HTTPS)
              </button>
              <button
                type="button"
                onClick={() => setNetworkMode('lan')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  networkMode === 'lan' ? 'bg-white text-[#1e293b] shadow-sm' : 'text-gray-600'
                }`}
              >
                <Wifi size={14} className="text-[#3B82F6]" /> Local Wi-Fi ({lanIp})
              </button>
            </div>
          )}

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 inline-block">
            <QRCodeSVG
              ref={svgRef}
              value={qrScanUrl}
              size={240}
              level="M"
              includeMargin={true}
              fgColor="#1e293b"
            />
          </div>

          <h3 className="font-bold text-xl text-gray-900 mb-2">{user.name}</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-3">
            Scan this QR code with your phone camera (on <strong>Mobile Data</strong> or <strong>Wi-Fi</strong>) or the in-app scanner to immediately view your medical report.
          </p>
          <a
            href={qrScanUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-[#10B981] hover:underline bg-white px-3 py-1.5 rounded-lg border border-gray-200 mb-6 break-all max-w-md inline-block"
          >
            {qrScanUrl}
          </a>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={downloadQR}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Download size={18} /> Download PNG
            </button>
            <Link
              to={`/scan-result/2?id=${encodeURIComponent(user.id)}`}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <ExternalLink size={18} /> Open Medical Report
            </Link>
            <button
              onClick={() => navigator.clipboard?.writeText(qrScanUrl)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Share2 size={18} /> Copy Scan Link
            </button>
          </div>
        </div>
      </div>

      {/* Patient One-Time Access Code (OTP) Generator Card */}
      <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-[44px] h-[44px] bg-[#F59E0B]/10 rounded-xl flex items-center justify-center text-[#F59E0B]">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Tier-2 Vault Unlock OTP</h3>
              <p className="text-xs text-gray-500">
                Generate a 6-digit One-Time Password to share with a hospital or doctor when they scan in Tier-3 mode.
              </p>
            </div>
          </div>
          <button
            onClick={generateOtp}
            disabled={generating}
            className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {activeOtp ? 'Regenerate OTP' : 'Generate 6-Digit OTP'}
          </button>
        </div>

        {activeOtp && (
          <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Active 6-Digit Security Code (Valid 5 mins)
              </div>
              <div className="font-mono text-2xl font-bold tracking-[0.35em] text-[#1e293b]">{activeOtp}</div>
              {expiresAt && (
                <div className="text-[11px] text-gray-400 mt-1">
                  Expires at {new Date(expiresAt).toLocaleTimeString()}
                </div>
              )}
            </div>
            <button
              onClick={copyOtp}
              className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {copied ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
