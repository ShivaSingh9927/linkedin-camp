import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export let io: Server;

export const initSocket = (httpServer: any) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'https://app.qampi.com,https://qampi.com,https://www.qampi.com')
        .split(',').map(s => s.trim()).filter(Boolean);
    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);

        socket.on('join_room', (data: { token: string }) => {
            try {
                const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET || 'super-secret-key-123');
                const userId = decoded.id;

                // Bind the verified identity to the SOCKET. Every later event
                // reads it from here rather than from the payload — a client
                // must never be able to name whose browser it is driving.
                (socket as any).userId = userId;
                socket.join(`user_${userId}`);
                console.log(`[SOCKET] User ${userId} joined room user_${userId}`);
            } catch (err) {
                console.error('[SOCKET] Join room failed: Invalid token');
            }
        });

        // Input relay for interactive (remote-controlled) LinkedIn login.
        // High-frequency (mousemove) — no logging here on purpose.
        socket.on('INTERACTIVE_INPUT', (evt: any) => {
            const userId = (socket as any).userId;
            if (!userId || !evt || typeof evt !== 'object') return;
            // Required lazily: session-manager imports `io` from this module,
            // so a top-level import would close the cycle.
            const { sessionManager } = require('../services/session-manager.service');
            void sessionManager.dispatchInput(userId, evt);
        });

        socket.on('disconnect', () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
        });
    });

    return io;
};
