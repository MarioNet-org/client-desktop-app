const { mkdir, readFile, writeFile, rename } = require('node:fs/promises');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');

function validateIcon(icon) {
  if (icon === null || icon === '') return null;
  if (typeof icon !== 'string' || icon.length > 1500000) throw new Error('INVALID_ICON');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(icon);
  if (!match) throw new Error('INVALID_ICON');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : match[1] === 'jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid || bytes.length > 1024 * 1024) throw new Error('INVALID_ICON');
  return icon;
}
function validatePreset(value) {
  if (!value || typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/.test(value.id)
    || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 40) throw new Error('INVALID_PRESET');
  return { id: value.id, name: value.name.trim(), icon: validateIcon(value.icon) };
}

class PresetStore {
  constructor(directory) { this.directory = directory; this.queue = Promise.resolve(); }
  filename(userId) { return path.join(this.directory, `${createHash('sha256').update(userId).digest('hex')}.json`); }
  async list(userId) {
    try {
      const data = JSON.parse(await readFile(this.filename(userId), 'utf8'));
      if (!Array.isArray(data) || data.length > 30) throw new Error('INVALID_PRESET');
      return data.map(validatePreset);
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  change(userId, transform) {
    const task = this.queue.then(async () => {
      const entries = transform(await this.list(userId));
      if (entries.length > 30 || JSON.stringify(entries).length > 20 * 1024 * 1024) throw new Error('PRESET_LIMIT');
      await mkdir(this.directory, { recursive: true });
      const filename = this.filename(userId);
      const temporary = `${filename}.tmp`;
      await writeFile(temporary, JSON.stringify(entries), { mode: 0o600 });
      await rename(temporary, filename);
      return entries;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  save(userId, input) {
    const preset = validatePreset({ ...input, id: input?.id ?? randomUUID() });
    return this.change(userId, entries => {
      const exists = entries.some(item => item.id === preset.id);
      if (input.id && !exists) throw new Error('PRESET_NOT_FOUND');
      return exists ? entries.map(item => item.id === preset.id ? preset : item) : [...entries, preset];
    });
  }
  delete(userId, id) {
    if (typeof id !== 'string') throw new Error('INVALID_PRESET');
    return this.change(userId, entries => entries.filter(item => item.id !== id));
  }
}
module.exports = { PresetStore, validateIcon };
