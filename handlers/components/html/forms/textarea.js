/**
 * handlers/components/html/forms/textarea.js
 *
 * Handler for the textarea intent. Receives the parsed intent map and the
 * watched DOM element. Walks frames/gates/triggers, attaches event listeners
 * for matched predicates, and acts on the handler payload.
 *
 * @param {object} intentMap  – Parsed JSON from /intents/.../textarea.json
 * @param {Element} target    – The watched <textarea> element
 */
export default function handle(intentMap, target) {
  const frames = ['program-intent', 'user-intent', 'business-intent'];
  const gates = ['halt', 'ask', 'act'];

  for (const frame of frames) {
    const frameData = intentMap[frame];
    if (!frameData) continue;

    for (const gate of gates) {
      const triggers = frameData[gate];
      if (!triggers) continue;

      for (const trigger of triggers) {
        for (const predicate of trigger.predicates) {
          if (predicate.type === 'event') {
            target.addEventListener(predicate.event, () => {
              if (trigger.handler['console-log']) {
                console.log(target.value);
              }
            });
          }
        }
      }
    }
  }
}
