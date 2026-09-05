#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

/**
 * Pulls the API contract from the backend so `npm run api:gen` can turn it into
 * TypeScript types.
 *
 * The backend derives openapi.json from its Zod schemas, which makes it the
 * single source of truth. This repository never hand-writes a request or
 * response type that the contract already describes — that is how two
 * repositories drift apart without anyone noticing until production.
 *
 * In CI, run `npm run api:sync` and fail the build if it produces a diff.
 */

const source = process.env.OPENAPI_URL ?? 'http://localhost:4000/openapi.json';
const target = new URL('../openapi.json', import.meta.url);

try {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`${source} responded ${response.status} ${response.statusText}`);
  }

  const spec = await response.json();
  await writeFile(target, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  const paths = Object.keys(spec.paths ?? {}).length;
  console.log(`Pulled ${paths} paths from ${source}`);
} catch (error) {
  console.error(`Could not pull the API contract from ${source}`);
  console.error(error instanceof Error ? error.message : error);
  console.error('\nStart the backend, or set OPENAPI_URL to a reachable spec.');
  process.exit(1);
}
