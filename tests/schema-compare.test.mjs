import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');

const compare = await readFile(resolve(root, 'tests/resources/schema-compare.md'), 'utf8');
const schema = await readFile(resolve(root, 'r/meta/schema.md'), 'utf8');

let passed = true;

for (let i = 0; i < Math.max(compare.length, schema.length); i++) {
  if (compare[i] !== schema[i]) {
    console.error(
      `Schema mismatch at index ${i}: ` +
      `schema-compare.md has ${JSON.stringify(compare[i] ?? '<EOF>')} ` +
      `but schema.md has ${JSON.stringify(schema[i] ?? '<EOF>')}`
    );
    passed = false;
    break;
  }
}

if (passed) {
  console.log('schema-compare: files match');
} else {
  process.exitCode = 1;
}
