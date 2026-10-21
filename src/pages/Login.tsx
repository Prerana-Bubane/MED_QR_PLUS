import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Shield } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Patient' | 'Hospital' | 'Admin'>('Patient');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, role)) {
      if (role === 'Admin') navigate('/admin');
      else navigate('/dashboard');
    } else {
      setError('Invalid credentials or account does not exist.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="flex items-center gap-2 text-primary font-heading font-bold text-2xl mb-8">
        <Shield className="text-accent" size={32} fill="currentColor" />
        <span>MED<span className="text-accent">QR+</span></span>
      </Link>
      
      <div className="bg-surface border border-border p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl text-center mb-6">Sign In</h1>
        
        {error && <div className="bg-danger/10 text-danger p-3 rounded-md mb-4 text-sm">{error}</div>}

        <div className="flex gap-2 mb-6 bg-background p-1 rounded-lg">
          {['Patient', 'Hospital', 'Admin'].map(r => (
            <button
              key={r}
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${role === r ? 'bg-surface shadow-sm text-primary' : 'text-text-muted hover:text-text'}`}
              onClick={() => setRole(r as any)}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full border border-border rounded-md px-3 py-2 outline-none focus:border-accent"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`enter ${role.toLowerCase()} email`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full border border-border rounded-md px-3 py-2 outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" fullWidth className="mt-2">Sign In as {role}</Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Don't have an account? <Link to="/register" className="text-accent hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
};
