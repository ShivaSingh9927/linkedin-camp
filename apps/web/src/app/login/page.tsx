'use client';

import { AuthLayout } from '@/components/AuthLayout';

export default function LoginPage() {
  return (
    <AuthLayout
      type="login"
      title="Welcome Back"
      description="Sign in to manage your LinkedIn campaigns."
    />
  );
}
