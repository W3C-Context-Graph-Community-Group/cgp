/**
 * lib/state-client/LogClient.js
 *
 * Browser-side ES module. Single canonical entrypoint for any page that
 * needs the raw CGP event log.
 *
 * Pipeline: fetch /api/log → onEntry each → ws /ws/updates → onEntry live
 *
 * Usage:
 *   import { connectToLog } from '/lib/state-client/LogClient.js';
 *   const conn = await connectToLog({
 *     onEntry(entry, seq) { renderEntry(entry); }
 *   });
 */

/**
 * @param {{ onEntry: (entry: object, seq: number) => void }} opts
 * @returns {Promise<{ close: () => void, seq: number }>}
 */
export async function connectToLog({ onEntry }) {
  let lastSeq = 0;

  // 1. Fetch historical log
  const res = await fetch('/api/log');
  const { entries } = await res.json();
  for (const entry of entries) {
    if (entry.seq > lastSeq) lastSeq = entry.seq;
    onEntry(entry, entry.seq);
  }

  // 2. Connect to /ws/updates for live entries
  const ws = new WebSocket(`ws://${location.host}/ws/updates`);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ since: lastSeq }));
  });

  ws.addEventListener('message', (e) => {
    const entry = JSON.parse(e.data);
    if (entry.seq <= lastSeq) return;
    lastSeq = entry.seq;
    onEntry(entry, entry.seq);
  });

  return {
    close() { ws.close(); },
    get seq() { return lastSeq; },
  };
}
