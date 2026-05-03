import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export let io: Server;

export const initSocket = (httpServer: any) => {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);

        socket.on('join_room', (data: { token: string }) => {
            try {
                const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET || 'super-secret-key-123');
                const userId = decoded.id;
                
                socket.join(`user_${userId}`);
                console.log(`[SOCKET] User ${userId} joined room user_${userId}`);
            } catch (err) {
                console.error('[SOCKET] Join room failed: Invalid token');
            }
        });

        socket.on('disconnect', () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
        });
    });

    return io;
};
