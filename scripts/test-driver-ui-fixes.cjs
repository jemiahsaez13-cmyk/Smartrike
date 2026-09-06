const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return exports;
}
(async () => {
  let calls = [];
  let result;
  const platform = { OS: 'web' };
  const picker = load('src/utils/pickImageDataUri.ts', {
    'react-native': { Platform: platform },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => { calls.push('permission'); return { granted: true }; },
      launchImageLibraryAsync: async () => { calls.push('picker'); return result; },
    },
  });
  result = { assets: [{ base64: '/9j/AAAA', mimeType: 'image/heic', fileSize: 9000000 }] };
  const pending = picker.pickImageDataUri();
  assert.deepEqual(calls, ['picker']);
  assert.equal(await pending, 'data:image/jpeg;base64,/9j/AAAA');
  platform.OS = 'android'; calls = [];
  await picker.pickImageDataUri(); assert.deepEqual(calls, ['permission', 'picker']);
  result = { canceled: true }; assert.equal(await picker.pickImageDataUri(), null);
  result = { assets: [{ base64: 'R0lGODlhAAAA' }] }; await assert.rejects(picker.pickImageDataUri(), /JPEG/);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([20,0,0,0]), Buffer.from('WEBPVP8 ')]).toString('base64');
  result = { assets: [{ base64: webp }] }; assert.equal(await picker.pickImageDataUri(), 'data:image/webp;base64,' + webp);
  result = { assets: [{ base64: '/9j/' + 'A'.repeat(3400000) }] }; await assert.rejects(picker.pickImageDataUri(), /2.5 MB/);
  console.log('PASS image picker: immediate web gesture, native permission, re-encoded image, cancellation, unsupported format, WebP, size limit');
  let saved;
  const chain = { update: row => { saved = row; return chain; }, eq: () => chain, select: () => chain, single: async () => ({ error: { message: 'No authorized row' } }) };
  const { UserRepository } = load('src/models/repositories/UserRepository.ts', { '@/config/supabase': { supabase: { from: () => chain } } });
  await assert.rejects(new UserRepository().updateDriverStatus('driver', 'online'));
  assert.equal(saved.current_status, 'online');
  console.log('PASS status write: denied or missing driver row rejects instead of reporting success');
})().catch(error => { console.error(error); process.exitCode = 1; });
