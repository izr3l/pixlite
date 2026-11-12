import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/validate.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const { IMAGE_UPLOAD_ACCEPT, isHeicFile, validateBatch, validateFile } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function heifHeader(major = 'heic', compatible = []) {
  const bytes = new Uint8Array(16 + compatible.length * 4);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  const encoder = new TextEncoder();
  bytes.set(encoder.encode('ftyp'), 4);
  bytes.set(encoder.encode(major), 8);
  compatible.forEach((brand, index) => bytes.set(encoder.encode(brand), 16 + index * 4));
  return bytes;
}

for (const mime of ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']) {
  test(`accepts HEVC bytes reported as ${mime}`, async () => {
    const file = new File([heifHeader('mif1', ['heic', 'hevc'])], 'photo.bin', { type: mime });
    assert.equal(isHeicFile(file), true);
    assert.equal((await validateFile(file)).valid, true);
    assert.ok(IMAGE_UPLOAD_ACCEPT.includes(mime));
  });
}

for (const mime of ['', 'application/octet-stream', 'application/heic', 'image/jpeg']) {
  test(`accepts genuine .HEIC bytes with ${mime || 'missing'} MIME`, async () => {
    const file = new File([heifHeader()], 'photo.HEIC', { type: mime });
    assert.equal(isHeicFile(file), true);
    assert.equal((await validateFile(file)).valid, true);
  });
}

test('accepts HEIF extension and HEVC compatible brands', async () => {
  const file = new File([heifHeader('mif1', ['heix'])], 'photo.HEIF');
  assert.equal((await validateFile(file)).valid, true);
});

for (const brand of ['mif1', 'msf1']) {
  test(`accepts decoder-supported generic ${brand} HEIF containers`, async () => {
    // The real libheif example fixture also decodes when its ftyp brands are
    // changed to these generic brands without changing its image payload.
    const file = new File([heifHeader(brand, [brand])], 'photo.heif', { type: 'image/heif' });
    assert.equal((await validateFile(file)).valid, true);
  });
}

for (const [label, bytes] of [
  ['JPEG renamed HEIC', new Uint8Array([255, 216, 255, ...new Array(13).fill(0)])],
  ['MP4', heifHeader('mp42', ['isom'])],
  ['AVIF', heifHeader('avif', ['mif1'])],
  ['AVIF with HEVC compatibility brand', heifHeader('mif1', ['avif', 'heic'])],
  ['truncated header', heifHeader().slice(0, 12)],
]) {
  test(`rejects ${label} even with HEIC extension/MIME`, async () => {
    assert.equal((await validateFile(new File([bytes], 'photo.heic', { type: 'image/heic' }))).valid, false);
  });
}

test('does not scan outside the declared ftyp box for a HEVC brand', async () => {
  const bytes = new Uint8Array(heifHeader('mp42', ['heic']));
  new DataView(bytes.buffer).setUint32(0, 16);
  assert.equal((await validateFile(new File([bytes], 'photo.heic'))).valid, false);
});

test('rejects a declared ftyp box larger than the file', async () => {
  const bytes = heifHeader();
  new DataView(bytes.buffer).setUint32(0, 32);
  assert.equal((await validateFile(new File([bytes], 'photo.heic'))).valid, false);
});

test('keeps the file-size limit', async () => {
  const file = new File([heifHeader()], 'photo.heic');
  Object.defineProperty(file, 'size', { value: 150 * 1024 * 1024 + 1 });
  assert.match((await validateFile(file)).error, /too large/);
});

test('keeps the queue limit', () => {
  const files = Array.from({ length: 3 }, (_, index) => new File([heifHeader()], `${index}.heic`));
  const result = validateBatch(files, 19);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejectedCount, 2);
});

test('keeps JPEG validation', async () => {
  const bytes = new Uint8Array(12);
  bytes.set([255, 216, 255]);
  assert.equal((await validateFile(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }))).valid, true);
  assert.equal((await validateFile(new File([bytes], 'photo.png', { type: 'image/png' }))).valid, false);
});
