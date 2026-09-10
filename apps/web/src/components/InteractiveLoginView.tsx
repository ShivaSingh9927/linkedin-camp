'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { Loader2, ShieldCheck } from 'lucide-react';

/**
 * Live view of the cloud browser during interactive LinkedIn sign-in.
 *
 * Exists because some LinkedIn accounts simply cannot use the password form:
 * ones created with "Continue with Google"/Apple have no password at all, and
 * passkey accounts can't authenticate to a datacenter browser (cross-device
 * passkeys need BLE proximity to the machine running the browser). Instead of
 * asking those users for a credential that doesn't exist, we stream them the
 * proxied browser and relay their input, so they sign in however they normally
 * do. The session cookies are minted inside the proxied context, which is what
 * keeps the sticky-proxy invariant intact.
 *
 * Frames arrive as base64 JPEG over the existing Socket.IO room; input goes
 * back as INTERACTIVE_INPUT and is dispatched via CDP.
 */

/** CDP wants Windows virtual key codes for non-printable keys. */
const VK: Record<string, number> = {
    Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18,
    CapsLock: 20, Escape: 27, ' ': 32, PageUp: 33, PageDown: 34,
    End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39,
    ArrowDown: 40, Delete: 46,
};

/** CDP modifier bitmask: alt=1, ctrl=2, meta=4, shift=8. */
function modifiersOf(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): number {
    return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

interface Props {
    socket: Socket | null;
    onCancel: () => void;
}

export default function InteractiveLoginView({ socket, onCancel }: Props) {
    const [frame, setFrame] = useState<string | null>(null);
    const [device, setDevice] = useState({ width: 1280, height: 800 });
    const imgRef = useRef<HTMLImageElement | null>(null);
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const lastMoveRef = useRef(0);

    useEffect(() => {
        if (!socket) return;
        const onFrame = (payload: { data: string; metadata?: { deviceWidth?: number; deviceHeight?: number } }) => {
            if (!payload?.data) return;
            setFrame(`data:image/jpeg;base64,${payload.data}`);
            const w = payload.metadata?.deviceWidth;
            const h = payload.metadata?.deviceHeight;
            // Track the real viewport so click coordinates stay correct even if
            // the remote page resizes mid-session.
            if (w && h) {
                setDevice((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
            }
        };
        socket.on('INTERACTIVE_FRAME', onFrame);
        return () => { socket.off('INTERACTIVE_FRAME', onFrame); };
    }, [socket]);

    const send = useCallback((evt: Record<string, unknown>) => {
        socket?.emit('INTERACTIVE_INPUT', evt);
    }, [socket]);

    /** Map a pointer position in the displayed image to remote viewport pixels. */
    const toDeviceCoords = useCallback((clientX: number, clientY: number) => {
        const el = imgRef.current;
        if (!el) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: 0, y: 0 };
        return {
            x: ((clientX - rect.left) / rect.width) * device.width,
            y: ((clientY - rect.top) / rect.height) * device.height,
        };
    }, [device.width, device.height]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        // Throttle: a raw mousemove stream would swamp the socket and starve
        // the far more important click/key events.
        const now = Date.now();
        if (now - lastMoveRef.current < 40) return;
        lastMoveRef.current = now;
        const { x, y } = toDeviceCoords(e.clientX, e.clientY);
        send({ kind: 'mouse', type: 'mouseMoved', x, y, modifiers: modifiersOf(e) });
    }, [send, toDeviceCoords]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        surfaceRef.current?.focus(); // so typing lands here, not on the page behind
        const { x, y } = toDeviceCoords(e.clientX, e.clientY);
        send({ kind: 'mouse', type: 'mousePressed', x, y, button: 'left', clickCount: e.detail || 1, modifiers: modifiersOf(e) });
    }, [send, toDeviceCoords]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        const { x, y } = toDeviceCoords(e.clientX, e.clientY);
        send({ kind: 'mouse', type: 'mouseReleased', x, y, button: 'left', clickCount: e.detail || 1, modifiers: modifiersOf(e) });
    }, [send, toDeviceCoords]);

    const onWheel = useCallback((e: React.WheelEvent) => {
        const { x, y } = toDeviceCoords(e.clientX, e.clientY);
        send({ kind: 'wheel', x, y, deltaX: e.deltaX, deltaY: e.deltaY, modifiers: modifiersOf(e) });
    }, [send, toDeviceCoords]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Leave copy/paste to the browser so onPaste can handle it as text.
        if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a'].includes(e.key.toLowerCase())) return;
        e.preventDefault();

        // Printable characters go in as TEXT, never as a synthesised key event.
        // Deriving a virtual key code from the character (charCodeAt) collides
        // catastrophically with the control-key range: '.' is 46, which is
        // VK_DELETE, so typing a period deleted forward instead. The same trap
        // catches '-' (45, Insert), '#' (35, End), '%' (37, Left) and most
        // other punctuation. insertText carries no key semantics, so there is
        // nothing to collide with.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            send({ kind: 'text', text: e.key });
            return;
        }

        send({
            kind: 'key',
            type: 'keyDown',
            key: e.key,
            code: e.code,
            text: e.key === 'Enter' ? '\r' : undefined,
            windowsVirtualKeyCode: VK[e.key],
            modifiers: modifiersOf(e),
        });
    }, [send]);

    const onKeyUp = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a'].includes(e.key.toLowerCase())) return;
        // Printable keys were delivered via insertText on keydown — a lone
        // keyUp for them would be meaningless (and would need the same bogus
        // key code we just removed).
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
        e.preventDefault();
        send({
            kind: 'key',
            type: 'keyUp',
            key: e.key,
            code: e.code,
            windowsVirtualKeyCode: VK[e.key],
            modifiers: modifiersOf(e),
        });
    }, [send]);

    const onPaste = useCallback((e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text');
        if (!text) return;
        e.preventDefault();
        send({ kind: 'text', text });
    }, [send]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-control bg-surface px-3 py-2 text-sm text-ink/70">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p>
                    Sign in to LinkedIn below — including <strong>Continue with Google</strong> or Apple if that&apos;s how
                    you joined. This is a real browser running on your dedicated IP; we never see your password.
                </p>
            </div>

            <div
                ref={surfaceRef}
                tabIndex={0}
                role="application"
                aria-label="LinkedIn sign-in browser"
                onMouseMove={onMouseMove}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onWheel={onWheel}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onPaste={onPaste}
                className="relative overflow-hidden rounded-card border border-line bg-black outline-none focus:ring-2 focus:ring-brand"
                style={{ aspectRatio: `${device.width} / ${device.height}` }}
            >
                {frame ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        ref={imgRef}
                        src={frame}
                        alt="LinkedIn sign-in"
                        draggable={false}
                        className="h-full w-full select-none"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-white/70">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting secure browser…
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-xs text-ink/50">
                <span>Click the view first, then type as you normally would.</span>
                <button type="button" onClick={onCancel} className="underline hover:text-ink">
                    Cancel
                </button>
            </div>
        </div>
    );
}
