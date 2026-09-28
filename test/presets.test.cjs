const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { PresetStore, validateIcon } = require('../electron/presets.cjs');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=';

test('presets persist, stay account-scoped, and support rename, icon replacement and deletion', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'marionet-presets-'));
  try {
    const store = new PresetStore(directory);
    assert.deepEqual(await store.list('user-a'), []);
    const created = await store.save('user-a', { name: ' 게임 ', icon: png });
    assert.equal(created[0].name, '게임');
    assert.deepEqual(await new PresetStore(directory).list('user-a'), created);
    assert.deepEqual(await store.list('user-b'), []);
    await assert.rejects(store.save('user-b', { ...created[0], name: 'stolen' }), /PRESET_NOT_FOUND/);
    const updated = await store.save('user-a', { ...created[0], name: '광클', icon: null });
    assert.equal(updated[0].id, created[0].id);
    assert.equal(updated[0].name, '광클');
    assert.equal(updated[0].icon, null);
    assert.deepEqual(await store.delete('user-a', created[0].id), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('serialized writes preserve concurrent additions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'marionet-presets-'));
  try {
    const store = new PresetStore(directory);
    await Promise.all(Array.from({ length: 10 }, (_, index) => store.save('user', { name: `Preset ${index}`, icon: null })));
    assert.equal((await store.list('user')).length, 10);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('icons must be bounded raster image data, never SVG or remote/file URLs', () => {
  assert.equal(validateIcon(png), png);
  for (const icon of ['file:///etc/passwd', 'https://example.com/icon.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,SGVsbG8=', 'x'.repeat(1500001)]) assert.throws(() => validateIcon(icon), /INVALID_ICON/);
});
