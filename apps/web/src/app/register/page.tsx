'use client';

import { AuthLayout } from '@/components/AuthLayout';

export default function RegisterPage() {
  return (
    <AuthLayout
      type="register"
      title="Create Account"
      description="Start your automated LinkedIn outreach in seconds."
    />
  );
}
