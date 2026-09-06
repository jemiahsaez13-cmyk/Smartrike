// UI_TEST_MODULES points to a directory with React 19.1 + react-test-renderer 19.1.
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const modules = process.env.UI_TEST_MODULES || path.join(__dirname, '../node_modules');
const React = require(path.join(modules, 'react'));
const { create, act } = require(path.join(modules, 'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT = true;
let emit, finishSubmit, closeCount = 0;
const host = Object.fromEntries(['ActivityIndicator','Image','Modal','ScrollView','TextInput','TouchableOpacity','View'].map(n => [n,n]));
const deps = {
 react: React,
 'react-native': { ...host, StyleSheet: { create: x => x }, AppState: { addEventListener: () => ({ remove() {} }) } },
 'react-native-paper': { Surface: 'Surface', Text: 'Text' },
 '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
 '@/models/services/RidePaymentService': { RidePaymentService: class {
   async getMethodsForRide() { return [{ id: 'method', display_name: 'GCash', method_type: 'gcash', account_name: 'Driver', account_number: '123456' }]; }
   submit() { return new Promise(resolve => { finishSubmit = resolve; }); }
 } },
 '@/models/services/RidePaymentSyncService': { watchRidePayment: (id, cb) => { emit = cb; return { refresh() {}, stop() {} }; } },
 '@/utils/pickImageDataUri': { pickImageDataUri: async () => null },
 '@/utils/confirm': { notify: () => { throw Error('Unexpected blocking dialog'); } },
 '@/views/styles/theme': { colors: {}, radius: {}, spacing: {}, typography: {} },
};
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/components/payment/PassengerRidePaymentModal.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { exports: out, require: name => { assert.ok(deps[name], name); return deps[name]; } });
const booking = { id:'ride', payment_status:'pending', payment_method:'online', total_fare:120 };
let root;
const Harness = () => {
 const [visible,setVisible] = React.useState(true);
 return React.createElement(out.PassengerRidePaymentModal, { booking, driverName:'Driver', visible,
 onClose: () => { closeCount++; setVisible(false); }, onStatus() {}, onBookingChanged() {} });
};
(async () => {
 await act(async () => { root = create(React.createElement(Harness)); });
 const submit = root.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === 'Submit for Verification'));
 let submission;
 await act(async () => { submission = submit.props.onPress(); });
 const close = root.root.findByProps({ accessibilityLabel:'Close payment' });
 assert.notEqual(close.props.disabled,true);
 await act(async () => { close.props.onPress(); });
 assert.equal(root.root.findByType('Modal').props.visible,false);
 await act(async () => { finishSubmit({ status:'pending' }); await submission; });
 assert.equal(root.root.findByType('Modal').props.visible,false);
 await act(async () => { root.unmount(); });
 await act(async () => { root = create(React.createElement(Harness)); });
 await act(async () => { emit({ status:'verified', payment_reference:'REF123' }, { ...booking,payment_status:'completed' }); });
 assert.equal(root.root.findByType('Modal').props.visible,false);
 assert.equal(closeCount,2);
 await act(async () => { root.unmount(); });
 console.log('PASS X closes during submission without reopening; verified update automatically dismisses passenger popup');
})().catch(e => { console.error(e); process.exitCode=1; });
