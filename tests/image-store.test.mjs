import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compilerOptions = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 };
const validationSource = readFileSync(new URL('../src/lib/validate.ts', import.meta.url), 'utf8');
const validationCompiled = ts.transpileModule(validationSource, { compilerOptions }).outputText;
const { isHeicFile, validateBatch, validateFile } = await import(
  `data:text/javascript;base64,${Buffer.from(validationCompiled).toString('base64')}`
);

// Exercise the real store actions in isolation. Only browser APIs, external
// services, and Zustand's small state container are substituted here.
const storeSource = ts.transpileModule(
  readFileSync(new URL('../src/store/useImageStore.ts', import.meta.url), 'utf8'),
  { compilerOptions },
).outputText.replace(/^import [^\n]*\n/gm, '')
  .replace('export const useImageStore', 'const useImageStore')
  .replaceAll('import.meta.url', JSON.stringify(new URL('../src/store/useImageStore.ts', import.meta.url).href));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function until(predicate, message) {
  for (let turn = 0; turn < 100; turn++) {
    if (predicate()) return;
    await nextTurn();
  }
  assert.fail(message);
}

function heicFile(name = 'photo.HEIC') {
  const bytes = new Uint8Array(28);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode('ftypmif1'), 4);
  bytes.set(new TextEncoder().encode('mif1heichevc'), 16);
  return new File([bytes], name, { type: 'image/heic' });
}

function jpegFile() {
  const bytes = new Uint8Array(12);
  bytes.set([255, 216, 255]);
  return new File([bytes], 'ordinary.jpg', { type: 'image/jpeg' });
}

function decodedPng() {
  return new Blob([new Uint8Array(128)], { type: 'image/png' });
}

function harness({ decode = async () => decodedPng(), metadata = async () => null } = {}) {
  let state;
  const messages = [];
  const decodeCalls = [];
  const metadataCalls = [];
  const errors = [];
  const createdUrls = new Set();
  const revokedUrls = new Set();

  class BrowserURL extends URL {
    static createObjectURL() {
      const url = `blob:store-test-${createdUrls.size}`;
      createdUrls.add(url);
      return url;
    }
    static revokeObjectURL(url) {
      revokedUrls.add(url);
    }
  }

  class ProcessingWorker {
    terminate() {}
    postMessage(message) {
      messages.push(message);
      const mime = message.settings.compress.outputFormat === 'original'
        ? message.fileType : message.settings.compress.outputFormat;
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
      queueMicrotask(() => this.onmessage({ data: {
        type: 'done',
        outputBlob: new Blob(['processed'], { type: mime }),
        outputFilename: `photo-optimised.${extension}`,
        stats: { originalSize: message.originalSize },
      } }));
    }
  }

  const context = vm.createContext({
    create: initializer => {
      const get = () => state;
      const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
      state = initializer(set, get);
      return { getState: get };
    },
    isHeicFile, validateBatch, validateFile,
    decodeHeic: file => {
      decodeCalls.push(file);
      return decode(file, decodeCalls.length);
    },
    parseMetadata: file => {
      metadataCalls.push(file);
      return metadata(file);
    },
    toast: { info() {}, error: message => errors.push(message) },
    crypto: { randomUUID },
    URL: BrowserURL,
    Worker: ProcessingWorker,
    createImageBitmap: async () => ({ width: 1280, height: 854, close() {} }),
    OffscreenCanvas: class {
      getContext() { return { drawImage() {} }; }
      async convertToBlob() { return new Blob(['thumbnail'], { type: 'image/jpeg' }); }
    },
    Blob, File, Error, Promise,
  });
  new vm.Script(storeSource).runInContext(context);
  return { get state() { return state; }, messages, decodeCalls, metadataCalls, errors, createdUrls, revokedUrls };
}

test('a slow HEIC upload is visible, selected, and loading before decoding finishes', async () => {
  const decoder = deferred();
  const h = harness({ decode: () => decoder.promise });
  const original = heicFile();
  const adding = h.state.addFiles([original]);
  await until(() => h.decodeCalls.length === 1, 'HEIC decoder did not start');

  assert.equal(h.state.files.length, 1);
  assert.equal(h.state.files[0].originalFile, original);
  assert.equal(h.state.files[0].status, 'loading');
  assert.equal(h.state.selectedFileId, h.state.files[0].id);
  assert.equal(h.messages.length, 0);

  const png = decodedPng();
  decoder.resolve(png);
  await adding;
  assert.equal(h.state.files[0].status, 'pending');
  assert.equal(h.state.files[0].decodedBlob, png);
});

test('failed HEIC remains visible with its filename and a retry decodes again successfully', async () => {
  const retryDecoder = deferred();
  const h = harness({ decode: (_file, attempt) => attempt === 1
    ? Promise.reject(new Error('Decoder could not open the image')) : retryDecoder.promise });
  const original = heicFile('holiday.heic');
  await h.state.addFiles([original]);
  const id = h.state.files[0].id;

  assert.equal(h.state.files.length, 1);
  assert.equal(h.state.files[0].status, 'error');
  assert.equal(h.state.files[0].originalFile, original);
  assert.match(h.state.files[0].error, /holiday\.heic/);
  assert.match(h.state.files[0].error, /Decoder could not open/);

  const retrying = h.state.processAll();
  await until(() => h.decodeCalls.length === 2, 'Retry did not invoke the decoder again');
  assert.equal(h.state.files[0].status, 'loading');
  assert.equal(h.state.files[0].error, null);
  retryDecoder.resolve(decodedPng());
  await retrying;
  assert.equal(h.state.files[0].id, id);
  assert.equal(h.state.files[0].status, 'done');
  assert.equal(h.messages.length, 1);
});

test('a successful HEIC retry restores original metadata without holding up processing', async () => {
  const metadata = deferred();
  const h = harness({
    decode: async (_file, attempt) => {
      if (attempt === 1) throw new Error('First decoder failed');
      return decodedPng();
    },
    metadata: () => metadata.promise,
  });
  const original = heicFile('portrait.heic');
  await h.state.addFiles([original]);
  assert.equal(h.state.files[0].status, 'error');
  assert.equal(h.metadataCalls.length, 0);

  await h.state.processAll();
  assert.equal(h.state.files[0].status, 'done');
  assert.equal(h.metadataCalls.length, 1);
  assert.equal(h.metadataCalls[0], original, 'Read EXIF from the HEIC original, not the decoded PNG');
  assert.equal(h.state.files[0].originalMetadata, null);
  const exif = { Make: 'Apple', Model: 'iPhone', Orientation: 1 };
  metadata.resolve(exif);
  await until(() => h.state.files[0].originalMetadata === exif, 'Retry did not restore original EXIF metadata');
});

test('clear all cancels files still being validated and allows a fresh upload afterwards', async () => {
  const h = harness();
  const first = heicFile('first.heic');
  const second = heicFile('second.heic');
  const secondBytes = await second.arrayBuffer();
  const validation = deferred();
  let validationStarted = false;
  Object.defineProperty(second, 'slice', { value: () => {
    validationStarted = true;
    return { arrayBuffer: () => validation.promise };
  } });

  const adding = h.state.addFiles([first, second]);
  await until(() => validationStarted && h.state.files.length === 1, 'Second file validation did not start');
  h.state.clearAll();
  validation.resolve(secondBytes);
  await adding;
  assert.equal(h.state.files.length, 0, 'Files from the cleared batch must not reappear');
  assert.equal(h.state.selectedFileId, null);
  assert.equal(h.decodeCalls.length, 0, 'Cleared files must not start decoding');
  assert.equal(h.createdUrls.size, 0);

  const fresh = heicFile('fresh.heic');
  await h.state.addFiles([fresh]);
  assert.equal(h.state.files.length, 1);
  assert.equal(h.state.files[0].originalFile, fresh);
  assert.equal(h.state.files[0].status, 'pending');
});

for (const action of ['remove', 'clear']) {
  test(`${action} during HEIC decoding does not restore the image or leak its thumbnail`, async () => {
    const decoder = deferred();
    const h = harness({ decode: () => decoder.promise });
    const adding = h.state.addFiles([heicFile()]);
    await until(() => h.decodeCalls.length === 1, 'HEIC decoder did not start');
    if (action === 'remove') h.state.removeFile(h.state.files[0].id);
    else h.state.clearAll();
    assert.equal(h.state.files.length, 0);

    decoder.resolve(decodedPng());
    await adding;
    assert.equal(h.state.files.length, 0);
    assert.equal(h.messages.length, 0);
    assert.deepEqual(h.revokedUrls, h.createdUrls, 'Every late thumbnail URL must be released');
  });
}

test('a JPEG in the same batch still loads and processes when HEIC decoding fails', async () => {
  const h = harness({ decode: async () => { throw new Error('Unsupported HEIC'); } });
  const heic = heicFile();
  const jpeg = jpegFile();
  await h.state.addFiles([heic, jpeg]);
  assert.equal(h.state.files.find(file => file.originalFile === heic).status, 'error');
  assert.equal(h.state.files.find(file => file.originalFile === jpeg).status, 'pending');
  await h.state.processAll();
  assert.equal(h.state.files.find(file => file.originalFile === jpeg).status, 'done');
  assert.equal(h.messages.find(message => message.fileName === jpeg.name).fileType, 'image/jpeg');
});

test('default HEIC processing sends JPEG output and preserves the original source size', async () => {
  const png = decodedPng();
  const h = harness({ decode: async () => png });
  const original = heicFile();
  await h.state.addFiles([original]);
  await h.state.processAll();
  const message = h.messages[0];
  assert.equal(message.fileName, original.name);
  assert.equal(message.fileType, 'image/png');
  assert.equal(message.fileBuffer.byteLength, png.size);
  assert.equal(message.originalSize, original.size);
  assert.notEqual(message.originalSize, png.size);
  assert.equal(message.settings.compress.outputFormat, 'image/jpeg');
  assert.equal(h.state.settings.compress.outputFormat, 'original');
});

test('an explicit WebP output choice is honored for HEIC images', async () => {
  const h = harness();
  await h.state.addFiles([heicFile()]);
  h.state.updateSettings({ compress: { ...h.state.settings.compress, outputFormat: 'image/webp' } });
  await h.state.processAll();
  assert.equal(h.messages[0].settings.compress.outputFormat, 'image/webp');
});

test('ordinary JPEG images bypass the HEIC decoder and preserve original output mode', async () => {
  const h = harness();
  const original = jpegFile();
  await h.state.addFiles([original]);
  await h.state.processAll();
  assert.equal(h.decodeCalls.length, 0);
  assert.equal(h.state.files[0].decodedBlob, null);
  assert.equal(h.messages[0].fileType, 'image/jpeg');
  assert.equal(h.messages[0].settings.compress.outputFormat, 'original');
});
