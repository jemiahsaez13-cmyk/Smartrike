// Isolated screen tests. UI_TEST_MODULES points to React/react-test-renderer 19.1.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const modules = process.env.UI_TEST_MODULES || path.join(__dirname, '../node_modules');
const React = require(path.join(modules, 'react'));
const { create, act } = require(path.join(modules, 'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT = true;

async function checkScreen(role, screen, serviceName) {
  const method = { id: 'method', method_type: 'gcash', display_name: 'GCash', account_name: 'Test Account', account_number: '09123456789', is_enabled: true };
  const calls = [], errors = [];
  let finish, fail;
  const toggle = (...args) => { calls.push(args); return new Promise((resolve, reject) => { finish = resolve; fail = reject; }); };
  const service = { listDriverMethods: async () => [method], listMethods: async () => [method], setMethodEnabled: toggle, setEnabled: toggle, deleteMethod: async () => {} };
  const deps = {
    react: React,
    'react-native': { ...Object.fromEntries(['Image', 'Modal', 'ScrollView', 'TextInput', 'TouchableOpacity', 'View'].map(x => [x, x])), StyleSheet: { create: x => x } },
    'react-native-paper': { Switch: 'Switch', Text: 'Text' },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]), useNavigation: () => ({ goBack() {} }) },
    '@/controllers/store': { useAppSelector: fn => fn({ auth: { user: { id: 'owner' } } }) },
    [`@/models/services/${serviceName}`]: { [serviceName]: class { constructor() { return service; } } },
    '@/utils/pickImageDataUri': { pickImageDataUri: async () => null },
    '@/utils/confirm': { notify: async (...args) => errors.push(args) },
    '@/views/components/common/Loading': { Loading: 'Loading' },
    '@/views/components/location/MapPinPicker': { MapPinPicker: 'MapPinPicker' },
    '@/views/styles/theme': { colors: {}, layout: {}, radius: {}, spacing: {}, typography: {} },
  };
  const out = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/views/screens/${role}/${screen}.tsx`, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports: out, require: name => { assert.ok(deps[name], name); return deps[name]; }, Set });
  let root;
  await act(async () => { root = create(React.createElement(out[screen])); });
  const control = () => root.root.findAllByType('Switch').find(x => x.props.accessibilityLabel === 'Enable GCash');
  const edit = () => root.root.findAllByType('TouchableOpacity').find(x => x.props.accessibilityLabel === 'Edit GCash');
  const modal = () => root.root.findByType('Modal');
  function assertNoPressAncestor(node) {
    for (let parent = node.parent; parent; parent = parent.parent) {
      assert.equal(parent.props.onPress, undefined, 'A switch/delete must not be nested inside the edit press target');
    }
  }
  assertNoPressAncestor(control());
  if (role === 'admin') assertNoPressAncestor(root.root.findAllByType('TouchableOpacity').find(x => x.props.accessibilityLabel === 'Delete GCash'));
  assert.equal(modal().props.visible, false);
  let pending;
  await act(async () => {
    const handler = control().props.onValueChange;
    pending = handler(false);
    void handler(false); // Same-frame repeat is ignored, even before disabled renders.
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['owner', 'method', false]);
  assert.equal(control().props.disabled, true);
  await act(async () => { edit().props.onPress(); });
  assert.equal(modal().props.visible, false);
  await act(async () => { finish(); await pending; });
  assert.equal(control().props.value, false);
  assert.equal(control().props.disabled, false);
  assert.equal(modal().props.visible, false);
  await act(async () => { pending = control().props.onValueChange(true); });
  await act(async () => { fail(new Error('Network unavailable')); await pending; });
  assert.equal(control().props.value, false, 'Failed update retains the saved value');
  assert.equal(control().props.disabled, false, 'Failure allows retry');
  assert.equal(errors.length, 1);
  await act(async () => { pending = control().props.onValueChange(true); });
  await act(async () => { finish(); await pending; });
  assert.equal(control().props.value, true);
  assert.equal(modal().props.visible, false);
  await act(async () => { edit().props.onPress(); });
  assert.equal(modal().props.visible, true, 'Card details still open editing');
  assert.ok(root.root.findAllByType('TextInput').some(x => x.props.value === '09123456789'), 'Editing preserves payment details');
  await act(async () => root.unmount());
  console.log(`PASS ${role}: independent switch/delete targets, off/on, duplicate guard, failure/retry, and card editing.`);
}
(async () => {
  await checkScreen('driver', 'OnlinePaymentSettingsScreen', 'RidePaymentService');
  await checkScreen('admin', 'AdminMtopPaymentSettingsScreen', 'AdminMtopPaymentService');
})().catch(error => { console.error(error); process.exitCode = 1; });
