import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const versions = [15, 16, 17];
const projectRoot = process.cwd();

const original = `if (h) {
  const {createRequire:a} = await import("node:module");
  var require = a(import.meta.url);
}`;

const replacement = `if (h) {
  const createRequire = globalThis.process?.getBuiltinModule?.("module")?.createRequire;
  if (!createRequire) {
    throw Error("node:module is unavailable in this runtime");
  }
  var require = createRequire(import.meta.url);
}`;

for (const version of versions) {
  const target = join(projectRoot, 'node_modules', '@supabase', 'pg-parser', 'wasm', String(version), 'pg-parser.js');
  const wasmSource = join(projectRoot, 'node_modules', '@supabase', 'pg-parser', 'wasm', String(version), 'pg-parser.wasm');
  const wasmTargetDir = join(projectRoot, 'public', 'pg-parser', String(version));
  const wasmTarget = join(wasmTargetDir, 'pg-parser.wasm');

  if (!existsSync(target)) {
    continue;
  }

  const source = readFileSync(target, 'utf8');

  if (!source.includes(replacement)) {
    if (!source.includes(original)) {
      throw new Error(`Could not find expected pg-parser block in ${target}`);
    }

    writeFileSync(target, source.replace(original, replacement), 'utf8');
  }

  if (existsSync(wasmSource)) {
    mkdirSync(wasmTargetDir, { recursive: true });
    copyFileSync(wasmSource, wasmTarget);
  }
}

const browserInitOriginal = `    return await createModule(
      isNode ? {
        locateFile: (path, scriptDirectory) => scriptDirectory + path
      } : void 0
    );`;

const browserInitReplacement = `    return await createModule({
      locateFile: (path, scriptDirectory) => isNode
        ? scriptDirectory + path
        : new URL(\`pg-parser/\${version}/\${path}\`, globalThis.document?.baseURI ?? globalThis.location?.href ?? scriptDirectory).href
    });`;

for (const relativePath of [
  join('node_modules', '@supabase', 'pg-parser', 'dist', 'index.js'),
  join('node_modules', '@supabase', 'pg-parser', 'dist', 'index.cjs')
]) {
  const target = join(projectRoot, relativePath);

  if (!existsSync(target)) {
    continue;
  }

  const source = readFileSync(target, 'utf8');

  if (source.includes(browserInitReplacement)) {
    continue;
  }

  if (!source.includes(browserInitOriginal)) {
    throw new Error(`Could not find expected PgParser init block in ${target}`);
  }

  writeFileSync(target, source.replace(browserInitOriginal, browserInitReplacement), 'utf8');
}
