/**
 * lib/state-client/StateClient.js
 *
 * Browser-side ES module. Single canonical entrypoint for any page that
 * needs the CGP hypergraph state.
 *
 * Pipeline: fetch /api/state → onUpdate → ws /ws/updates → refetch on tick → onUpdate
 *
 * Usage:
 *   import { connectToState } from '/lib/state-client/StateClient.js';
 *   const conn = await connectToState({
 *     onUpdate(state, seq) { render(state); }
 *   });
 */

/**
 * @param {{ onUpdate: (state: object, seq: number) => void }} opts
 * @returns {Promise<{ close: () => void, seq: number }>}
 */
export async function connectToState({ onUpdate }) {
  let lastSeq = 0;

  // 1. Fetch initial state snapshot
  const res = await fetch('/api/state');
  const { state, seq } = await res.json();
  lastSeq = seq;
  onUpdate(state, seq);

  // 2. Connect to /ws/updates for live triggers
  const ws = new WebSocket(`ws://${location.host}/ws/updates`);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ since: lastSeq }));
  });

  ws.addEventListener('message', async (e) => {
    const entry = JSON.parse(e.data);
    if (entry.seq <= lastSeq) return;
    lastSeq = entry.seq;

    // 3. Refetch authoritative state at this seq
    const r = await fetch(`/api/state?at=${entry.seq}`);
    const { state: newState, seq: newSeq } = await r.json();
    onUpdate(newState, newSeq);
  });

  return {
    close() { ws.close(); },
    get seq() { return lastSeq; },
  };
}
