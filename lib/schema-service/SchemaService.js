import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

export class SchemaService {
  constructor(opts = {}) {
    this._ajv = new Ajv2020({ allErrors: true, ...opts });
    addFormats(this._ajv);
  }

  /**
   * Compile and cache a schema by id.
   * @param {string} id   CGP URL or arbitrary key
   * @param {object} schema  JSON Schema object
   */
  addSchema(id, schema) {
    this._ajv.addSchema(schema, id);
  }

  /**
   * Recursively load all *.schema.json files from a directory.
   * Each schema is keyed by its $id field.
   * @param {string} dir  Absolute path to directory
   * @returns {Promise<number>}  Number of schemas loaded
   */
  async loadDir(dir) {
    let count = 0;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await this.loadDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const raw = await readFile(full, 'utf-8');
        const schema = JSON.parse(raw);
        const id = schema.$id;
        if (id) {
          this._ajv.addSchema(schema, id);
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Scan event .md files for "Validates against:" lines and register
   * the referenced schema under the channel URL derived from the file path.
   * @param {string} eventsDir  Absolute path to events directory
   * @returns {Promise<number>}  Number of channel bindings registered
   */
  async loadEventBindings(eventsDir) {
    let count = 0;
    const entries = await readdir(eventsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const full = join(eventsDir, entry.name);
      const content = await readFile(full, 'utf-8');
      const match = content.match(/\*\*Validates against:\*\*\s*`([^`]+)`/);
      if (!match) continue;
      const schemaUrl = match[1]; // e.g. cgp:/r/schemas/observatron.schema.json
      const schemaFilename = schemaUrl.split('/').pop(); // e.g. observatron.schema.json
      const validate = this._ajv.getSchema(schemaFilename);
      if (!validate) continue;
      const channelUrl = `cgp:/r/events/${entry.name}`;
      this._ajv.addSchema(validate.schema, channelUrl);
      count++;
    }
    return count;
  }

  /**
   * Validate data against a schema by id.
   * @param {string} id   Schema id (CGP URL or key)
   * @param {*} data       Data to validate
   * @returns {{ valid: boolean, errors: null | import('ajv').ErrorObject[] }}
   */
  validate(id, data) {
    const validate = this._ajv.getSchema(id);
    if (!validate) {
      return { valid: true, errors: null };   // no schema → pass through
    }
    const valid = validate(data);
    return { valid, errors: valid ? null : validate.errors };
  }

  /**
   * Check whether a schema is registered for the given id.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return !!this._ajv.getSchema(id);
  }
}
