import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DashboardShell } from './pages/DashboardShell';
import { AdminConsole } from './pages/AdminConsole';
import { QRPass } from './pages/QRPass';
import { Scanner } from './pages/Scanner';
import { ScanResult } from './pages/ScanResult';
import { Dashboard, Profile, MedicalRecords, PatientsAccessed, ScanHistory, AIAssistant, MapView } from './pages/DashboardPages';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  
  if (user.role === 'Hospital' && !(user as any).verified && window.location.pathname !== '/dashboard/pending') {
    return <Navigate to="/dashboard/pending" />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <AdminConsole />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/pending" element={
            <ProtectedRoute allowedRoles={['Hospital']}>
              <div className="p-10 text-center font-bold text-xl mt-20">Your hospital account is pending verification by an Admin.</div>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="qr" element={<QRPass />} />
            <Route path="records" element={<MedicalRecords />} />
            <Route path="patients" element={<PatientsAccessed />} />
            <Route path="history" element={<ScanHistory />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="map" element={<MapView />} />
            <Route path="scanner" element={<Scanner />} />
          </Route>

          <Route path="/scan-result/:tier?" element={<ScanResult />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
