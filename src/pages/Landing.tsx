import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, QrCode, Lock, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'Admin') navigate('/admin');
      else navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100 flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] bg-[#10B981] rounded-[10px] flex items-center justify-center shadow-sm">
            <Shield className="text-white" size={22} fill="currentColor" />
          </div>
          <div>
            <div className="font-bold text-[20px] leading-tight tracking-tight text-[#1e293b]">MED<span className="text-[#10B981]">QR+</span></div>
            <div className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">Secured Health</div>
          </div>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors">Sign In</Link>
          <Link to="/register" className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-[10px] text-sm font-bold shadow-sm transition-colors">Get Started</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#10B981] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
          <Lock size={14} /> 3-Tier Encrypted Access
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-[#1e293b] leading-tight mb-6">
          The future of medical <br/> records is <span className="text-[#10B981]">in your pocket.</span>
        </h1>
        
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          MEDQR+ provides patients with a secure, offline-capable QR pass that grants emergency responders and hospitals instant, permissioned access to critical health data.
        </p>

        <div className="flex justify-center gap-4 mb-24">
          <Link to="/register" className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-8 py-4 rounded-[12px] font-bold shadow-md transition-colors text-lg">
            Create Patient Pass
          </Link>
          <Link to="/register?type=hospital" className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-8 py-4 rounded-[12px] font-bold shadow-sm transition-colors text-lg">
            Hospital Portal
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-[48px] h-[48px] bg-[#10B981]/10 rounded-xl flex items-center justify-center text-[#10B981] mb-6">
              <QrCode size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Instant QR Pass</h3>
            <p className="text-gray-500 leading-relaxed text-sm">Generate a unique QR code that stores your encrypted medical profile, scannable by any verified hospital.</p>
          </div>
          
          <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-[48px] h-[48px] bg-[#3B82F6]/10 rounded-xl flex items-center justify-center text-[#3B82F6] mb-6">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Tiered Privacy</h3>
            <p className="text-gray-500 leading-relaxed text-sm">Control who sees what. Paramedics see allergies; your doctor sees full records via OTP unlock.</p>
          </div>
          
          <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-[48px] h-[48px] bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center text-[#8B5CF6] mb-6">
              <Bot size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">AI Health Coach</h3>
            <p className="text-gray-500 leading-relaxed text-sm">Chat securely with our clinical AI to understand your lab results and track your medications.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
