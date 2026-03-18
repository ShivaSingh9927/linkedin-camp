'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/AuthLayout';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Fix potential trailing slash in API URL
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const fullUrl = `${baseUrl}/auth/register`;
      
      console.log(`[DEBUG] Registration attempt to: ${fullUrl}`);

      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log(`[DEBUG] Registration response status: ${res.status}`);
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Account created successfully!');
        router.push('/');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('[DEBUG] Registration Error:', error);
      toast.error('An error occurred. Please try again.');
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
