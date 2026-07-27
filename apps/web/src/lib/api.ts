import axios from 'axios';
import { resetAnalytics } from '@/lib/analytics';

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
const api = axios.create({
    baseURL: `${baseUrl}/api/v1`,
});

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const operatingUserId = localStorage.getItem('operatingUserId');
        if (operatingUserId) {
            config.headers['x-operating-user-id'] = operatingUserId;
        }
    }
    return config;
});

// Auto-logout on 401 (stale token / deleted user).
//
// Only log out when a request that ACTUALLY carried a token is rejected — that's
// a genuinely expired/invalid session. A 401 on a request with no Authorization
// header just means a poller (e.g. Sidebar's /leads/follow-ups, the health
// banner's /session/health) fired before the token was written; treating that
// as a logout used to nuke the token the OAuth callback had just stored and
// bounce every LinkedIn/Microsoft sign-in to /login.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const hadAuth = !!error.config?.headers?.Authorization;
        if (error.response?.status === 401 && hadAuth && typeof window !== 'undefined') {
            resetAnalytics();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Only redirect if not already on an auth route.
            const p = window.location.pathname;
            if (!p.startsWith('/login') && !p.startsWith('/register') && !p.startsWith('/auth/callback')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

