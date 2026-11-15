#!/usr/bin/env node
// Creates .env from .env.example, replacing every <generate:…> placeholder with
// a fresh random secret. Refuses to overwrite an existing file.
//
//   node scripts/setup-env.mjs                                 .env.example → .env
//   node scripts/setup-env.mjs vercel.env.example .env.vercel  (npm run setup:vercel-env)
import { randomBytes, randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [templateName = ".env.example", targetName = ".env"] = process.argv.slice(2);
const target = new URL(`../${targetName}`, import.meta.url);
const template = new URL(`../${templateName}`, import.meta.url);

if (existsSync(target)) {
  console.error(`${targetName} already exists — not overwriting. Delete it first to regenerate.`);
  process.exit(1);
}

const hex = (bytes) => randomBytes(bytes).toString("hex");
const generators = {
  hex: (bytes) => hex(Number(bytes)),
  // Garage access key IDs are "GK" followed by 32 hex characters.
  "garage-key-id": () => `GK${hex(16)}`,
  // Letters and digits only: safe to paste anywhere.
  password: (length) => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    return Array.from({ length: Number(length) }, () => alphabet[randomInt(alphabet.length)]).join("");
  },
};

const values = {};
let content = readFileSync(template, "utf8").replace(
  /^([A-Z0-9_]+)=<generate:([a-z-]+)(?::(\d+))?>$/gm,
  (_line, key, kind, arg) => {
    const generate = generators[kind];
    if (!generate) throw new Error(`Unknown generator "${kind}" for ${key}`);
    values[key] = generate(arg);
    return `${key}=${values[key]}`;
  },
);
// Fill references such as <POSTGRES_PASSWORD> with the value generated above.
content = content.replace(/<([A-Z0-9_]+)>/g, (match, key) => values[key] ?? match);

writeFileSync(target, content, { mode: 0o600 });
console.log(`Created ${targetName} with fresh secrets (file mode 600).`);
