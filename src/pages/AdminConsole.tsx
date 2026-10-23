import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import type { Hospital } from '../types';
import { Shield, CheckCircle, XCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminConsole = () => {
  const { getAllUsers, updateUser, user, logout } = useAuth();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<Hospital[]>(
    getAllUsers().filter(u => u.role === 'Hospital') as Hospital[]
  );

  useEffect(() => {
    apiFetch('/api/users')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { users?: Hospital[] }) => {
        if (Array.isArray(data.users)) {
          setHospitals(data.users.filter((u) => u.role === 'Hospital') as Hospital[]);
        }
      })
      .catch(() => {});
  }, []);

  const handleStatusChange = (hospitalId: string, status: 'verified' | 'rejected') => {
    const hospital = hospitals.find(h => h.id === hospitalId);
    if (hospital) {
      const updated = { ...hospital, status, verified: status === 'verified' };
      updateUser(updated);
      setHospitals(hospitals.map(h => h.id === hospitalId ? updated : h));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-[#1e293b] text-white p-4 shadow-md flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] bg-[#10B981] rounded-[10px] flex items-center justify-center">
            <Shield size={20} fill="currentColor" />
          </div>
          <span className="font-bold text-xl tracking-tight">MED<span className="text-[#10B981]">QR+</span> <span className="text-gray-400 font-normal text-sm ml-2">| Admin Console</span></span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium">Logged in as: {user?.name}</span>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors bg-white/10 px-4 py-2 rounded-lg">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Hospital Approvals</h1>
            <p className="text-gray-500">Manage hospital access and verify licenses.</p>
          </div>
        </div>

        <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hospital Name</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">License Number</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Contact Person</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No hospitals registered yet.</td></tr>
              ) : (
                hospitals.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{h.name}</td>
                    <td className="p-4 font-mono text-sm text-gray-600">{h.licenseNumber}</td>
                    <td className="p-4 text-sm text-gray-600">{h.contactPerson}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        h.status === 'verified' ? 'bg-[#10B981]/10 text-[#10B981]' : 
                        h.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      {h.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusChange(h.id, 'verified')} className="bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors">
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button onClick={() => handleStatusChange(h.id, 'rejected')} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors">
                            <XCircle size={14} /> Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};
