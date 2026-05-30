import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const backendUrl = rawUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/api/webhooks/:path*',
        destination: `${backendUrl}/api/webhooks/:path*`,
      },
    ];
  },
};

export default nextConfig;
