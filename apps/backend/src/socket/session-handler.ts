import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export function initSessionSocketHandler(io: Server) {
    io.on('connection', (socket: Socket) => {
        socket.on('start_socket_login', async (data: { token: string }) => {
            try {
                const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET || 'super-secret-key-123');
                const userId = decoded.id;
                console.log(`[SOCKET-SESSION] User ${userId} requested socket login start`);

                const { sessionManager } = await import('../services/session-manager.service');
                const result = await sessionManager.startLogin(userId);

                if (!result.success) {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'FAILED',
                        error: result.error,
                        message: result.error
                    });
                }
            } catch (err: any) {
                console.error(`[SOCKET-SESSION] start_socket_login error: ${err.message}`);
                socket.emit('SESSION_LOGIN_STATUS', {
                    status: 'FAILED',
                    error: 'Authentication failed'
                });
            }
        });

        socket.on('submit_credentials', async (data: { token: string; email: string; password: string }) => {
            try {
                const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET || 'super-secret-key-123');
                const userId = decoded.id;
                console.log(`[SOCKET-SESSION] User ${userId} submitting credentials`);

                const { sessionManager } = await import('../services/session-manager.service');
                const result = await sessionManager.submitCredentials(userId, data.email, data.password);

                if (result.error) {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'FAILED',
                        error: result.error
                    });
                } else if (result.requires2FA) {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'AWAITING_2FA',
                        message: 'Security verification required'
                    });
                } else {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'SUCCESS',
                        message: 'Successfully connected!'
                    });
                }
            } catch (err: any) {
                console.error(`[SOCKET-SESSION] submit_credentials error: ${err.message}`);
                socket.emit('SESSION_LOGIN_STATUS', {
                    status: 'FAILED',
                    error: 'Authentication failed'
                });
            }
        });

        socket.on('submit_2fa_code', async (data: { token: string; code: string }) => {
            try {
                const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET || 'super-secret-key-123');
                const userId = decoded.id;
                console.log(`[SOCKET-SESSION] User ${userId} submitting 2FA code`);

                const { sessionManager } = await import('../services/session-manager.service');
                const result = await sessionManager.submit2FA(userId, data.code);

                if (result.error) {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'FAILED',
                        error: result.error
                    });
                } else {
                    socket.emit('SESSION_LOGIN_STATUS', {
                        status: 'SUCCESS',
                        message: 'Successfully connected!'
                    });
                }
            } catch (err: any) {
                console.error(`[SOCKET-SESSION] submit_2fa_code error: ${err.message}`);
                socket.emit('SESSION_LOGIN_STATUS', {
                    status: 'FAILED',
                    error: 'Authentication failed'
                });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[SOCKET-SESSION] Client disconnected: ${socket.id}`);
        });
    });
}
