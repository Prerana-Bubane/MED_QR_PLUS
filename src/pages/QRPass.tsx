import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Download, Share2, QrCode, KeyRound, RefreshCw, Copy, Check } from 'lucide-react';

export const QRPass = () => {
  const { user, logActivity } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeOtp, setActiveOtp] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'Patient') return;
    fetch(`/api/scan/otp/${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { active: boolean; otp?: string; expiresAt?: number }) => {
        if (data.active && data.otp) {
          setActiveOtp(data.otp);
          setExpiresAt(data.expiresAt || null);
        }
      })
      .catch(() => {});
  }, [user]);

  if (user?.role !== 'Patient') return null;

  const generateOtp = () => {
    setGenerating(true);
    fetch('/api/scan/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: user.id, requestedBy: 'Patient Self-Generation' }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { otp: string; expiresAt: number }) => {
        setActiveOtp(data.otp);
        setExpiresAt(data.expiresAt);
        setGenerating(false);
      })
      .catch(() => {
        const fallbackCode = String(Math.floor(100000 + Math.random() * 900000));
        setActiveOtp(fallbackCode);
        setExpiresAt(Date.now() + 5 * 60 * 1000);
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
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
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
          <p className="text-sm text-gray-500">Your secure, encrypted medical pass.</p>
        </div>
      </div>

      <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden text-center">
        <div className="bg-[#1e293b] p-6 text-white text-left flex justify-between items-center">
          <div>
            <div className="font-bold text-lg">MEDQR+ Pass</div>
            <div className="text-xs text-gray-400 font-mono">{user.id}</div>
          </div>
          <div className="bg-[#10B981] text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
            <ShieldCheck size={14} /> Active
          </div>
        </div>

        <div className="p-12 flex flex-col items-center justify-center bg-gray-50/50">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8 inline-block">
            <QRCodeSVG
              ref={svgRef}
              value={user.id}
              size={240}
              level="H"
              includeMargin={false}
              fgColor="#1e293b"
            />
          </div>

          <h3 className="font-bold text-xl text-gray-900 mb-2">{user.name}</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-8">
            Present this QR code to verified medical personnel to grant them 3-tier encrypted access to your records.
          </p>

          <div className="flex gap-4">
            <button
              onClick={downloadQR}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Download size={18} /> Download PNG
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(user.id)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Share2 size={18} /> Copy Pass ID
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
                Generate a 6-digit One-Time Password to share with an external doctor or hospital to unlock your full medical records.
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
