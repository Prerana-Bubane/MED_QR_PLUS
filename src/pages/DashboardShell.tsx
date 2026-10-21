
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, User as UserIcon, QrCode, FileText, Users, History, Bot, Map, Scan, LogOut } from 'lucide-react';

export const DashboardShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = user?.role === 'Patient' ? [
    { to: '/dashboard', icon: <div className="w-5 h-5 flex items-center justify-center"><Shield size={18} /></div>, label: 'Home' },
    { to: '/dashboard/profile', icon: <div className="w-5 h-5 flex items-center justify-center"><UserIcon size={18} /></div>, label: 'My Profile' },
    { to: '/dashboard/qr', icon: <div className="w-5 h-5 flex items-center justify-center"><QrCode size={18} /></div>, label: 'My QR Code' },
    { to: '/dashboard/records', icon: <div className="w-5 h-5 flex items-center justify-center"><FileText size={18} /></div>, label: 'Medical Records' },
    { to: '/dashboard/ai', icon: <div className="w-5 h-5 flex items-center justify-center"><Bot size={18} /></div>, label: 'AI Assistant' },
    { to: '/dashboard/map', icon: <div className="w-5 h-5 flex items-center justify-center"><Map size={18} /></div>, label: 'Support Map' },
    { to: '/dashboard/scanner', icon: <div className="w-5 h-5 flex items-center justify-center"><Scan size={18} /></div>, label: 'QR Scanner' },
  ] : [
    { to: '/dashboard', icon: <div className="w-5 h-5 flex items-center justify-center"><Shield size={18} /></div>, label: 'Home' },
    { to: '/dashboard/profile', icon: <div className="w-5 h-5 flex items-center justify-center"><UserIcon size={18} /></div>, label: 'Hospital Profile' },
    { to: '/dashboard/scanner', icon: <div className="w-5 h-5 flex items-center justify-center"><Scan size={18} /></div>, label: 'Scan QR Pass' },
    { to: '/dashboard/patients', icon: <div className="w-5 h-5 flex items-center justify-center"><Users size={18} /></div>, label: 'Patients Accessed' },
    { to: '/dashboard/history', icon: <div className="w-5 h-5 flex items-center justify-center"><History size={18} /></div>, label: 'Scan History' },
    { to: '/dashboard/ai', icon: <div className="w-5 h-5 flex items-center justify-center"><Bot size={18} /></div>, label: 'Clinical Assistant' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#1e293b] text-white flex flex-col flex-shrink-0 shadow-lg z-20">
        {/* Logo Lockup */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#10B981] flex items-center justify-center flex-shrink-0">
            <Shield className="text-white" size={22} fill="currentColor" />
          </div>
          <div>
            <div className="font-bold text-[20px] leading-tight tracking-tight">MED<span className="text-[#10B981]">QR+</span></div>
            <div className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">Secured Health</div>
          </div>
        </div>
        
        {/* User Info Strip */}
        <div className="px-6 py-4 flex items-center gap-3 border-t border-white/5 mx-2">
          <div className="w-9 h-9 bg-gray-700 text-white rounded-full flex items-center justify-center font-bold text-sm border border-gray-600 flex-shrink-0">
            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[14px] text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-[#10B981] font-mono truncate">{user?.id}</div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-6 mt-4 mb-2">
          <div className="text-[11px] text-gray-500 font-bold tracking-wider uppercase">Navigation</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 flex flex-col gap-[2px]">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => 
                `flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-all duration-200 ${
                  isActive 
                  ? 'bg-white/10 text-white border-l-[3px] border-[#10B981] font-medium shadow-sm' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-[3px] border-transparent'
                }`
              }
            >
              <div className="opacity-90">{item.icon}</div>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Sign Out */}
        <div className="p-4 mt-auto border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-[10px] text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-medium group"
          >
            <LogOut size={18} className="group-hover:text-red-400" /> Sign Out ({user?.role})
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-10 shadow-sm">
          <h2 className="font-bold text-xl text-[#1e293b]">Overview</h2>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-bold text-[13px] text-[#1e293b] leading-tight">{user?.name}</div>
              <div className="text-[11px] text-gray-500 font-mono">{user?.id}</div>
            </div>
            <div className="w-8 h-8 bg-gray-100 text-gray-700 border border-gray-200 rounded-full flex items-center justify-center font-bold text-[11px]">
              {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
