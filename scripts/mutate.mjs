#!/usr/bin/env node
// Mutate openapi.json in place. Usage examples:
//   node scripts/mutate.mjs add-endpoint --path /v1/widgets --method get --op listWidgets --tag widgets
//   node scripts/mutate.mjs remove-endpoint --path /v1/items/{id} --method get
//   node scripts/mutate.mjs rename-op --path /v1/items --method get --to listAllItems
//   node scripts/mutate.mjs add-field --schema Item --field color --type string
//   node scripts/mutate.mjs bump-version --to 1.1.0
//
// Writes pretty JSON. Exits non-zero on validation errors.

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "..", "openapi.json");

const parseArgs = (argv) => {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, "");
    const val = rest[i + 1];
    if (!key || val === undefined) throw new Error(`Bad flag near "${rest[i]}"`);
    opts[key] = val;
  }
  return { cmd, opts };
};

const loadSpec = async () => JSON.parse(await readFile(SPEC_PATH, "utf8"));
const saveSpec = (spec) =>
  writeFile(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

const ensure = (cond, msg) => {
  if (!cond) {
    console.error(`error: ${msg}`);
    process.exit(1);
  }
};

const commands = {
  "add-endpoint": (spec, { path, method, op, tag }) => {
    ensure(path && method && op, "need --path, --method, --op");
    const m = method.toLowerCase();
    spec.paths[path] ??= {};
    ensure(!spec.paths[path][m], `${method.toUpperCase()} ${path} already exists`);
    spec.paths[path][m] = {
      operationId: op,
      summary: `Auto-added ${op}`,
      tags: tag ? [tag] : ["fake"],
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    };
  },

  "remove-endpoint": (spec, { path, method }) => {
    ensure(path && method, "need --path, --method");
    const m = method.toLowerCase();
    ensure(spec.paths[path]?.[m], `${method.toUpperCase()} ${path} not found`);
    delete spec.paths[path][m];
    if (Object.keys(spec.paths[path]).length === 0) delete spec.paths[path];
  },

  "rename-op": (spec, { path, method, to }) => {
    ensure(path && method && to, "need --path, --method, --to");
    const op = spec.paths[path]?.[method.toLowerCase()];
    ensure(op, `${method.toUpperCase()} ${path} not found`);
    op.operationId = to;
  },

  "add-field": (spec, { schema, field, type }) => {
    ensure(schema && field && type, "need --schema, --field, --type");
    const s = spec.components?.schemas?.[schema];
    ensure(s, `schema ${schema} not found`);
    s.properties ??= {};
    ensure(!s.properties[field], `field ${field} already exists on ${schema}`);
    s.properties[field] = { type };
  },

  "bump-version": (spec, { to }) => {
    ensure(to, "need --to");
    spec.info.version = to;
  },
};

const main = async () => {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (!cmd || !commands[cmd]) {
    console.error(`usage: mutate.mjs <${Object.keys(commands).join("|")}> [flags]`);
    process.exit(1);
  }
  const spec = await loadSpec();
  commands[cmd](spec, opts);
  await saveSpec(spec);
  console.log(`ok: ${cmd} applied`);
};

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
