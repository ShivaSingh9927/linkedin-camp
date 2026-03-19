'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/AuthLayout';
import api from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data;

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Welcome back, ${data.user.email.split('@')[0]}!`);
      router.push('/');
    } catch (error: any) {
      console.error('[DEBUG] Login Error:', error);
      const errorMessage = error.response?.data?.error || 'Login failed';
      toast.error(errorMessage === 'Login failed' ? 'An error occurred. Please try again.' : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      type="login"
      title="Welcome Back"
      description="Access your dashboard and manage your LinkedIn campaigns."
      loading={loading}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
