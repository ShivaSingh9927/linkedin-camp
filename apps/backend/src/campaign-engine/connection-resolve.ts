// Who is this lead to us, right now?
//
// One answer, shared. The IF_ELSE gate decides whether to message at all from
// this, and SEND_MESSAGE decides how to phrase its close from it — and when
// those two disagreed about the same lead, a message went to an existing
// connection asking them to connect. Kept free of engine imports so any node
// can use it without an import cycle.

export interface ResolvedConnection {
    connected: boolean | null;
    connectionStatus: 'not_connected' | 'pending' | 'connected' | 'unknown';
    connectionDegree: number | null;
    from: 'check-connection' | 'lead-row' | 'profile-visit' | 'none';
}

/**
 * Decide the lead's connection state, freshest source first.
 *
 * Order matters and is the whole point of this function:
 *
 *   1. CHECK_CONNECTION's output — the node sitting immediately before this
 *      gate in every DM template. It ran seconds ago. It is the answer.
 *   2. The Lead row — last confirmed state from any earlier run, the extension
 *      scrape, or a previous probe. Free (already fetched), no network.
 *   3. PROFILE_VISIT's output — correct when it's all we have, but in the
 *      standard templates it sits on the far side of a `WAIT 1d`, so it can be
 *      a day or more stale.
 *
 * The old code read ONLY (3), which is why a lead confirmed 1st-degree seconds
 * earlier by CHECK_CONNECTION was skipped on the strength of a day-old cached
 * `false`. Recency wins now.
 *
 * A source only counts as having answered when it actually knows. `null`/
 * `'unknown'` falls through to the next source, and if nothing knows we return
 * `connected: null` rather than inventing a negative.
 */
export function resolveConnection(
    ctxConnectionStatus: 'not_connected' | 'pending' | 'connected' | 'unknown' | undefined,
    storedOutputs: Record<string, Record<string, any>>,
    leadStatus: string | null,
    leadConnectionDegree: number | null,
): ResolvedConnection {
    // ---- 1. Freshest: whichever CHECK_CONNECTION backend just ran ----
    // Both node variants persist under their own key; prefer the DOM one when
    // both are present since it reads the exact degree.
    const cc = storedOutputs['check-connection'] || storedOutputs['check-connection-voyager'];
    if (cc && cc.connected != null) {
        return {
            connected: !!cc.connected,
            connectionStatus: cc.connectionStatus || (cc.connected ? 'connected' : 'not_connected'),
            connectionDegree: cc.connectionDegree ?? (cc.connected ? 1 : leadConnectionDegree),
            from: 'check-connection',
        };
    }
    // The node may have run and reported 'pending' — a real answer (invite
    // sent, not yet accepted) even though `connected` is false-y.
    if (cc?.connectionStatus === 'pending') {
        return { connected: false, connectionStatus: 'pending', connectionDegree: leadConnectionDegree, from: 'check-connection' };
    }

    // ---- 2. Last known DB state (free — the row is already loaded) ----
    // This is the fallback that rescues the exact bug we're fixing: a live
    // probe that failed, on a lead we have previously confirmed as 1st-degree.
    if (leadStatus === 'CONNECTED' || leadConnectionDegree === 1) {
        return { connected: true, connectionStatus: 'connected', connectionDegree: leadConnectionDegree ?? 1, from: 'lead-row' };
    }
    if (leadConnectionDegree != null && leadConnectionDegree > 1) {
        return { connected: false, connectionStatus: 'not_connected', connectionDegree: leadConnectionDegree, from: 'lead-row' };
    }

    // ---- 3. Oldest: PROFILE_VISIT, possibly from before a multi-day delay ----
    const pv = storedOutputs['profile-visit'] || storedOutputs['profile-visit-voyager'];
    if (pv && pv.connected != null) {
        return {
            connected: !!pv.connected,
            connectionStatus: pv.connected ? 'connected' : 'not_connected',
            connectionDegree: pv.connectionDegree ?? (pv.connected ? 1 : null),
            from: 'profile-visit',
        };
    }

    // ---- 4. A run-level seed, if the engine had one ----
    if (ctxConnectionStatus && ctxConnectionStatus !== 'unknown') {
        return {
            connected: ctxConnectionStatus === 'connected',
            connectionStatus: ctxConnectionStatus,
            connectionDegree: leadConnectionDegree,
            from: 'lead-row',
        };
    }

    // ---- Nothing knew ----
    return { connected: null, connectionStatus: 'unknown', connectionDegree: leadConnectionDegree, from: 'none' };
}
