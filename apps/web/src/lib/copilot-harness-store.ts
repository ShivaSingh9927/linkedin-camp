export interface CopilotHarnessTurn {
    id: string;
    createdAt: number;
    kind: 'route' | 'reply_draft';
    inputChars?: number;
    outputChars?: number;
    historyTurns?: number;
    intentHinted?: boolean;
    intent?: string;
    needsConfirm?: boolean;
    success: boolean;
    latencyMs: number;
    errorCode?: string;
    qualityFlags?: string[];
    outcome?: 'generated' | 'edited' | 'regenerated' | 'sent' | 'send_failed' | 'failed';
    edited?: boolean;
    tone?: string;
}

const DB_NAME = 'qampi-copilot-harness';
const DB_VERSION = 1;
const STORE = 'turns';
const MAX_TURNS = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}

function complete(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
    });
}

async function prune(db: IDBDatabase): Promise<void> {
    const tx = db.transaction(STORE, 'readwrite');
    const txDone = complete(tx);
    const store = tx.objectStore(STORE);
    const index = store.index('createdAt');
    const cutoff = Date.now() - MAX_AGE_MS;
    const keys: IDBValidKey[] = [];
    await new Promise<void>((resolve) => {
        const cursor = index.openKeyCursor();
        cursor.onsuccess = () => {
            const row = cursor.result;
            if (!row) return resolve();
            if (Number(row.key) < cutoff) keys.push(row.primaryKey);
            row.continue();
        };
        cursor.onerror = () => resolve();
    });
    for (const key of keys) store.delete(key);
    await txDone;

    const countTx = db.transaction(STORE, 'readwrite');
    const countDone = complete(countTx);
    const countStore = countTx.objectStore(STORE);
    const count = await new Promise<number>((resolve) => {
        const request = countStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
    });
    let remove = Math.max(0, count - MAX_TURNS);
    if (remove > 0) {
        await new Promise<void>((resolve) => {
            const cursor = countStore.index('createdAt').openKeyCursor();
            cursor.onsuccess = () => {
                const row = cursor.result;
                if (!row || remove <= 0) return resolve();
                countStore.delete(row.primaryKey);
                remove -= 1;
                row.continue();
            };
            cursor.onerror = () => resolve();
        });
    }
    await countDone;
}

/** Store privacy-minimized copilot telemetry locally. Never pass message text. */
export async function recordCopilotHarnessTurn(turn: CopilotHarnessTurn): Promise<void> {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(STORE, 'readwrite');
    const txDone = complete(tx);
    tx.objectStore(STORE).put(turn);
    await txDone;
    await prune(db);
    db.close();
}

export async function updateCopilotHarnessTurn(
    id: string,
    patch: Partial<Omit<CopilotHarnessTurn, 'id' | 'createdAt' | 'kind'>>,
): Promise<void> {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(STORE, 'readwrite');
    const txDone = complete(tx);
    const store = tx.objectStore(STORE);
    await new Promise<void>((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => {
            const current = request.result as CopilotHarnessTurn | undefined;
            if (current) store.put({ ...current, ...patch });
            resolve();
        };
        request.onerror = () => resolve();
    });
    await txDone;
    db.close();
}

export async function readCopilotHarnessTurns(): Promise<CopilotHarnessTurn[]> {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction(STORE, 'readonly');
    const txDone = complete(tx);
    const rows = await new Promise<CopilotHarnessTurn[]>((resolve) => {
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result as CopilotHarnessTurn[]);
        request.onerror = () => resolve([]);
    });
    await txDone;
    db.close();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function clearCopilotHarnessTurns(): Promise<void> {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(STORE, 'readwrite');
    const txDone = complete(tx);
    tx.objectStore(STORE).clear();
    await txDone;
    db.close();
}
