import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/heic.ts', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8').replaceAll('import.meta.url', JSON.stringify(sourceUrl.href));
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const image = new File(['test HEIC bytes'], 'photo.heic', { type: 'image/heic' });
const png = () => new Blob(['decoded pixels'], { type: 'image/png' });
const flush = () => new Promise(resolve => setImmediate(resolve));

function runtime(overrides = {}) {
  const workers = [];
  const timers = new Map();
  let nextTimer = 0;
  class MockWorker {
    terminated = 0;
    constructor(url, options) {
      this.url = url;
      this.options = options;
      workers.push(this);
    }
    postMessage(file) { this.file = file; }
    terminate() { this.terminated++; }
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Blob,
    URL,
    Worker: MockWorker,
    createImageBitmap: async () => { throw new Error('Native HEIC unsupported'); },
    setTimeout: (callback, duration) => {
      const id = ++nextTimer;
      timers.set(id, { callback, duration });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    ...overrides,
  }, { filename: sourceUrl.pathname });
  return { decodeHeic: exports.decodeHeic, workers, timers };
}

test('native HEIC decoding avoids loading a fallback worker and releases its bitmap', async () => {
  const result = png();
  const bitmap = { width: 1280, height: 854, closes: 0, close() { this.closes++; } };
  const canvases = [];
  const context = { drawImage: () => {} };
  const app = runtime({
    createImageBitmap: async () => bitmap,
    OffscreenCanvas: class {
      constructor(width, height) { canvases.push(this); this.width = width; this.height = height; }
      getContext() { return context; }
      async convertToBlob(options) { assert.equal(options.type, 'image/png'); return result; }
    },
  });
  assert.equal(await app.decodeHeic(image), result);
  assert.equal(app.workers.length, 0);
  assert.equal(bitmap.closes, 1);
  assert.equal(canvases[0].width, 1);
  assert.equal(canvases[0].height, 1);
});

test('native decoding can encode through a DOM canvas when OffscreenCanvas is unavailable', async () => {
  const result = png();
  let closed = false;
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (callback, type) => { assert.equal(type, 'image/png'); callback(result); },
  };
  const app = runtime({
    createImageBitmap: async () => ({ width: 640, height: 480, close() { closed = true; } }),
    document: { createElement: type => { assert.equal(type, 'canvas'); return canvas; } },
  });
  assert.equal(await app.decodeHeic(image), result);
  assert.equal(app.workers.length, 0);
  assert.equal(closed, true);
  assert.equal(canvas.width, 1);
});

test('unsupported native HEIC uses a worker that is terminated after success', async () => {
  const app = runtime();
  const task = app.decodeHeic(image);
  await flush();
  const worker = app.workers[0];
  assert.equal(worker.file, image);
  assert.match(worker.url.href, /workers\/heic\.worker\.ts$/);
  assert.equal(worker.options.type, 'module');
  const result = png();
  worker.onmessage({ data: { type: 'done', blob: result } });
  assert.equal(await task, result);
  assert.equal(worker.terminated, 1);
  assert.equal(app.timers.size, 0);
  assert.equal(worker.onmessage, null);
});

test('a decoder crash is rejected and a retry gets a fresh worker', async () => {
  const app = runtime();
  const first = app.decodeHeic(image);
  const rejection = assert.rejects(first, /stopped unexpectedly/);
  await flush();
  const crashed = app.workers[0];
  let prevented = false;
  crashed.onerror({ preventDefault() { prevented = true; } });
  await rejection;
  assert.equal(prevented, true);
  assert.equal(crashed.terminated, 1);
  assert.equal(app.timers.size, 0);

  const retry = app.decodeHeic(image);
  await flush();
  assert.equal(app.workers.length, 2);
  const fresh = app.workers[1];
  const result = png();
  fresh.onmessage({ data: { type: 'done', blob: result } });
  assert.equal(await retry, result);
  assert.equal(fresh.terminated, 1);
});

test('a stalled decoder times out instead of leaving the upload promise pending', async () => {
  const app = runtime();
  const task = app.decodeHeic(image);
  const rejection = assert.rejects(task, /took too long/);
  await flush();
  const timer = [...app.timers.values()][0];
  assert.equal(timer.duration, 90_000);
  timer.callback();
  await rejection;
  assert.equal(app.workers[0].terminated, 1);
  assert.equal(app.timers.size, 0);
});

test('message deserialization errors reject and release the worker', async () => {
  const app = runtime();
  const task = app.decodeHeic(image);
  const rejection = assert.rejects(task, /could not be read/);
  await flush();
  app.workers[0].onmessageerror();
  await rejection;
  assert.equal(app.workers[0].terminated, 1);
  assert.equal(app.timers.size, 0);
});

test('unavailable workers produce an actionable browser compatibility error', async () => {
  const app = runtime({ Worker: class { constructor() { throw new Error('Blocked'); } } });
  await assert.rejects(app.decodeHeic(image), /unavailable in this browser/);
  assert.equal(app.timers.size, 0);
});

test('failed file cloning releases the worker and rejects the upload', async () => {
  class BrokenWorker {
    terminated = 0;
    constructor() { BrokenWorker.instance = this; }
    postMessage() { throw new Error('DataCloneError'); }
    terminate() { this.terminated++; }
  }
  const broken = runtime({ Worker: BrokenWorker });
  await assert.rejects(broken.decodeHeic(image), /could not be read/);
  assert.equal(BrokenWorker.instance.terminated, 1);
  assert.equal(broken.timers.size, 0);
});

test('decoder failures and invalid responses reject without leaking workers', async () => {
  for (const response of [{ type: 'error', message: 'Unsupported codec' }, { type: 'done', blob: new Blob() }, null]) {
    const app = runtime();
    const task = app.decodeHeic(image);
    const rejection = assert.rejects(task, /could not be decoded/);
    await flush();
    app.workers[0].onmessage({ data: response });
    await rejection;
    assert.equal(app.workers[0].terminated, 1);
    assert.equal(app.timers.size, 0);
  }
});
