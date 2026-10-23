import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Shield } from 'lucide-react';

export const Register = () => {
  const [role, setRole] = useState<'Patient' | 'Hospital'>('Patient');
  const { registerPatient, registerHospital } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('type') === 'hospital') {
      setRole('Hospital');
    }
  }, [location]);

  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (role === 'Patient') {
      const result = await registerPatient(formData);
      setSubmitting(false);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Failed to register patient account.');
      }
    } else {
      const result = await registerHospital(formData);
      setSubmitting(false);
      if (result.success) {
        navigate('/dashboard/pending');
      } else {
        setError(result.error || 'Failed to register hospital account.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-10">
      <Link to="/" className="flex items-center gap-2 text-primary font-heading font-bold text-2xl mb-8">
        <Shield className="text-accent" size={32} fill="currentColor" />
        <span>MED<span className="text-accent">QR+</span></span>
      </Link>

      <div className="bg-surface border border-border p-8 rounded-xl shadow-md w-full max-w-2xl">
        <h1 className="text-2xl text-center mb-6">Create Account</h1>

        {error && <div className="bg-danger/10 text-danger p-3 rounded-md mb-4 text-sm font-medium">{error}</div>}

        <div className="flex gap-2 mb-6 bg-background p-1 rounded-lg w-full max-w-xs mx-auto">
          {(['Patient', 'Hospital'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                role === r ? 'bg-surface shadow-sm text-primary' : 'text-text-muted hover:text-text'
              }`}
              onClick={() => {
                setRole(r);
                setError('');
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {role === 'Patient' ? (
              <>
                <Input label="Full Name" name="name" onChange={handleInputChange} required />
                <Input label="Email" name="email" type="email" onChange={handleInputChange} required />
                <Input label="Phone" name="phone" onChange={handleInputChange} required />
                <Input label="Date of Birth" name="dob" type="date" onChange={handleInputChange} required />
                <Input label="Gender" name="gender" onChange={handleInputChange} required />
                <Input label="Blood Group" name="bloodGroup" onChange={handleInputChange} required />
                <Input label="Address" name="address" onChange={handleInputChange} required />
              </>
            ) : (
              <>
                <Input label="Hospital Name" name="name" onChange={handleInputChange} required />
                <Input label="Email" name="email" type="email" onChange={handleInputChange} required />
                <Input label="Phone" name="phone" onChange={handleInputChange} required />
                <Input label="License Number" name="licenseNumber" onChange={handleInputChange} required />
                <Input label="Address" name="address" onChange={handleInputChange} required />
                <Input label="Contact Person" name="contactPerson" onChange={handleInputChange} required />
                <Input label="Department" name="department" onChange={handleInputChange} required />
              </>
            )}
            <Input
              label="Password (min 6 characters)"
              name="password"
              type="password"
              minLength={6}
              onChange={handleInputChange}
              required
            />
          </div>

          <Button type="submit" fullWidth className="mt-4" disabled={submitting}>
            {submitting ? 'Creating Account...' : `Register as ${role}`}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <input
      className="w-full border border-border rounded-md px-3 py-2 outline-none focus:border-accent"
      {...props}
    />
  </div>
);
