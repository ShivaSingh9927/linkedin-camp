'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/AuthLayout';
import api from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { email, password });
      const data = res.data;

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Account created successfully!');
      router.push('/');
    } catch (error: any) {
      console.error('[DEBUG] Registration Error:', error);
      const errorMessage = error.response?.data?.error || 'Registration failed';
      toast.error(errorMessage === 'Registration failed' ? 'An error occurred. Please try again.' : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      type="register"
      title="Create Account"
      description="Start your automated LinkedIn outreach today."
      loading={loading}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
