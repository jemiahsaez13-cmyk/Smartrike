const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let payload;
let expectedRpc = 'submit_ride_payment';
let response = { data: [{ id: 'payment', status: 'pending' }], error: null };
let calls = 0;
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/models/services/RidePaymentService.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, {
  exports: exportsObject,
  require: name => {
    assert.equal(name, '@/config/supabase');
    return { supabase: { rpc: async (name, params) => {
      assert.equal(name, expectedRpc);
      calls++;
      payload = params;
      return response;
    } } };
  },
});
(async () => {
  const service = new exportsObject.RidePaymentService();
  const payment = await service.submit('booking', 'method', ' REF-123456 ', 'data:image/png;base64,AAAA');
  assert.equal(payment.status, 'pending');
  assert.deepEqual(Object.keys(payload).sort(), ['p_booking_id', 'p_method_id', 'p_proof_url', 'p_reference']);
  assert.equal(payload.p_reference, 'REF-123456');
  console.log('PASS proof submission sends only the four RPC parameters, without display-only name fields');
  expectedRpc = 'review_ride_payment';
  response = { data: [{ id: 'payment', status: 'verified' }], error: null };
  assert.equal((await service.review('payment', 'verified')).status, 'verified');
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { p_payment_id: 'payment', p_decision: 'verified', p_reason: null });
  const previousCalls = calls;
  await assert.rejects(service.review('payment', 'rejected', '  '), /reason/);
  assert.equal(calls, previousCalls);
  response = { data: [{ id: 'payment', status: 'rejected' }], error: null };
  await service.review('payment', 'rejected', ' Reference does not match ');
  assert.equal(payload.p_reason, 'Reference does not match');
  response = { data: null, error: { message: 'Function unavailable', code: 'PGRST202' } };
  await assert.rejects(service.review('payment', 'verified'), error => error.code === 'PGRST202');
  console.log('PASS verification RPC parameters, rejection reason validation, and backend errors propagated');

})().catch(error => { console.error(error); process.exitCode = 1; });
