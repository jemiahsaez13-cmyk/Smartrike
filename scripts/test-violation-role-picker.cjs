// UI_TEST_MODULES points to React/react-test-renderer 19.1.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const modules = process.env.UI_TEST_MODULES || path.join(__dirname, '../node_modules');
const React = require(path.join(modules, 'react'));
const { create, act } = require(path.join(modules, 'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT = true;
const saved = [], notifications = [];
const deps = {
  react: React,
  'react-native': { ...Object.fromEntries(['ActivityIndicator', 'Modal', 'RefreshControl', 'ScrollView', 'TextInput', 'TouchableOpacity', 'View'].map(x => [x, x])), StyleSheet: { create: x => x } },
  'react-native-paper': { Text: 'Text' },
  '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]), useNavigation: () => ({ goBack() {} }) },
  '@/controllers/store': { useAppSelector: fn => fn({ auth: { user: { id: 'admin' } } }) },
  '@/models/services/AssociationService': { ViolationService: class {
    async list() { return []; }
    async record(payload) { saved.push(payload); return { ...payload, id: String(saved.length), status: 'open' }; }
  } },
  '@/models/services/AdminService': { AdminService: class { async getAllUsers() { return [
    { id: 'driver', name: 'Test Driver', user_type: 'driver' },
    { id: 'passenger', name: 'Test Passenger', user_type: 'passenger' },
    { id: 'admin', name: 'Test Admin', user_type: 'admin' },
  ]; } } },
  '@/utils/confirm': { confirm: async () => true, notify: async (...args) => notifications.push(args) },
  '@/views/styles/theme': { colors: {}, layout: {}, radius: {}, spacing: {}, typography: {} },
  '@/views/components/common/Card': { Card: 'Card' },
};
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/screens/admin/ViolationManagementScreen.tsx', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { exports: out, require: name => { assert.ok(deps[name], name); return deps[name]; } });
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
let root;
const button = label => root.root.findAllByType('TouchableOpacity').find(x => text(x) === label);
const press = async label => { assert.ok(button(label), label); await act(async () => button(label).props.onPress()); };
const picker = () => root.root.findAllByType('Modal')[1];
(async () => {
  await act(async () => { root = create(React.createElement(out.ViolationManagementScreen, { embedded: true })); });
  await press('Record');
  await press('Select a driver...');
  assert.ok(text(picker()).includes('Test Driver'));
  assert.ok(!text(picker()).includes('Test Passenger'));
  assert.ok(!text(picker()).includes('Test Admin'));
  await act(async () => picker().findAllByType('TouchableOpacity').find(x => text(x).includes('Test Driver')).props.onPress());
  await press('Passenger');
  assert.ok(button('Select a passenger...'), 'Changing role clears the selected driver');
  await press('Select a passenger...');
  assert.ok(text(picker()).includes('Test Passenger'));
  assert.ok(!text(picker()).includes('Test Driver'));
  await act(async () => picker().findAllByType('TouchableOpacity').find(x => text(x).includes('Test Passenger')).props.onPress());
  await press('No-show at pickup');
  await press('Save Violation Record');
  assert.equal(saved[0].passenger_id, 'passenger');
  assert.equal(saved[0].driver_id, null);
  assert.equal(saved[0].violation_type, 'No-show at pickup');
  await press('Record');
  await press('Select a driver...');
  await act(async () => picker().findAllByType('TouchableOpacity').find(x => text(x).includes('Test Driver')).props.onPress());
  await press('Reckless driving');
  await press('Save Violation Record');
  assert.equal(saved[1].driver_id, 'driver');
  assert.equal(saved[1].passenger_id, null);
  assert.equal(saved[1].violation_type, 'Reckless driving');
  assert.ok(notifications.every(x => x[0] === 'Violation recorded'));
  await act(async () => root.unmount());
  console.log('PASS: driver/passenger dropdown filtering, role reset, role-specific presets, and both manual save payloads.');
})().catch(error => { console.error(error); process.exitCode = 1; });
