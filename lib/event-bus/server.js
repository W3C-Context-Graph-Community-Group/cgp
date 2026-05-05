import { WebSocketServer } from 'ws';
import { SchemaService } from '../schema-service/SchemaService.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, '..', '..', 'r', 'schemas');

const PORT = parseInt(process.env.BUS_PORT || '8080', 10);

const schemas = new SchemaService();
const schemaCount = await schemas.loadDir(SCHEMAS_DIR);
console.log(`Loaded ${schemaCount} schema(s) from ${SCHEMAS_DIR}`);

const wss = new WebSocketServer({ port: PORT });
const subscriptions = new Map();   // url → Set<ws>
let nextId = 1;

wss.on('connection', (ws) => {
  const clientId = String(nextId++);
  ws._clientId = clientId;
  ws._subs = new Set();            // urls this client is subscribed to
  ws.send(JSON.stringify({ action: 'welcome', clientId }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { action, url } = msg;
    if (typeof url !== 'string') return;

    if (action === 'subscribe') {
      if (!subscriptions.has(url)) subscriptions.set(url, new Set());
      subscriptions.get(url).add(ws);
      ws._subs.add(url);
    }

    if (action === 'unsubscribe') {
      subscriptions.get(url)?.delete(ws);
      ws._subs.delete(url);
    }

    if (action === 'emit') {
      // Validate payload against schema if one is registered for this URL
      if (schemas.has(url) && msg.payload !== undefined) {
        const { valid, errors } = schemas.validate(url, msg.payload);
        if (!valid) {
          ws.send(JSON.stringify({ action: 'validation-error', url, errors }));
          return;
        }
      }

      const emittedPayload = msg.payload !== undefined ? msg.payload : null;
      const outgoing = JSON.stringify({ event: url, from: clientId, payload: emittedPayload });
      const subs = subscriptions.get(url);
      if (subs) {
        for (const client of subs) {
          if (client !== ws && client.readyState === 1) {
            client.send(outgoing);
          }
        }
      }
    }
  });

  ws.on('close', () => {
    for (const url of ws._subs) {
      subscriptions.get(url)?.delete(ws);
    }
  });
});

console.log(`Event bus listening on ws://localhost:${PORT}`);
