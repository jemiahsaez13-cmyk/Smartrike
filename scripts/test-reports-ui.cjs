// UI_TEST_MODULES points to React 19.1 and react-test-renderer 19.1.
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const modules = process.env.UI_TEST_MODULES || path.join(__dirname, '../node_modules');
const React = require(path.join(modules, 'react'));
const { create, act } = require(path.join(modules, 'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT = true;
let confirmed = false, conversions = [], statuses = [], navigated = 0;
const rows = [
  { id: 'driver-report', status: 'reviewed', reporter_role: 'passenger', reason: 'Unsafe driving' },
  { id: 'passenger-report', status: 'open', reporter_role: 'driver', reason: 'No show' },
  { id: 'linked', status: 'actioned', reporter_role: 'passenger', reason: 'Fare', violation: { id: 'violation', status: 'resolved' } },
];
const native = Object.fromEntries(['View', 'TouchableOpacity', 'RefreshControl', 'ActivityIndicator', 'ScrollView'].map(x => [x, x]));
const deps = {
  react: React,
  'react-native': { ...native, StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 320, height: 640 }),
    FlatList: ({ data, renderItem }) => React.createElement('List', {}, data.map(item => React.createElement('Row', { key: item.id, id: item.id }, renderItem({ item })))) },
  'react-native-paper': { Text: 'Text' },
  '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  '@react-navigation/native': { useNavigation: () => ({ goBack() {} }) },
  '@/models/services/ReportService': { ReportService: class {
    async listReports() { return rows; }
    async setStatus(id, status) { statuses.push([id, status]); }
    async recordViolation(id) { conversions.push(id); }
  } },
  '@/views/styles/theme': { colors: {}, layout: {}, radius: {}, spacing: {}, typography: {} },
  '@/utils/confirm': { confirm: async () => confirmed, notify: async () => { throw Error('Unexpected error dialog'); } },
  '@/utils/dateUtils': { formatDate: () => 'Sep 8, 2026' },
};
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/screens/admin/AdminReportsScreen.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { exports: out, require: name => { assert.ok(deps[name], name); return deps[name]; } });
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
let root;
const button = (row, label) => root.root.findAllByType('Row').find(x => x.props.id === row)
  .findAllByType('TouchableOpacity').find(x => text(x) === label);
(async () => {
  await act(async () => { root = create(React.createElement(out.AdminReportsScreen, { embedded: true, onViolationRecorded: () => navigated++ })); });
  assert.ok(button('driver-report', 'Record Driver Violation'), 'Reviewed reports still offer action');
  await act(async () => { await button('driver-report', 'Record Driver Violation').props.onPress(); });
  assert.equal(conversions.length, 0, 'Cancelling never creates a violation');
  assert.equal(statuses.length, 0, 'Cancelling never dismisses the report');
  confirmed = true;
  await act(async () => { await button('driver-report', 'Record Driver Violation').props.onPress(); });
  assert.deepEqual(conversions, ['driver-report']);
  assert.equal(navigated, 1);
  await act(async () => { await button('passenger-report', 'Record Passenger Violation').props.onPress(); });
  assert.deepEqual(statuses, []);
  assert.deepEqual(conversions, ['driver-report', 'passenger-report']);
  assert.equal(navigated, 2, 'Passenger reports also create linked violations');
  assert.equal(button('linked', 'Reopen'), undefined, 'Linked reports cannot reopen independently');
  assert.ok(text(root.root).includes('Linked violation: resolved'));
  await act(async () => { button('linked', 'View Violations').props.onPress(); });
  assert.equal(navigated, 3);
  await act(async () => root.unmount());
  console.log('PASS: reviewed report actions, cancel safety, driver conversion, passenger actions, linked outcome and navigation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
