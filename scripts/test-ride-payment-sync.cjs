const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let proof = { status: 'pending' }, booking = { id: 'ride', payment_status: 'pending' };
let readProof = async () => proof, readBooking = async () => booking;
let tick, reconnect, removed = 0, cleared = 0;
const events = [];
const channel = { on(kind, filter, fn) { events.push({ filter, fn }); return channel; }, subscribe(fn) { reconnect = fn; return channel; } };
const deps = {
  '@/config/supabase': { supabase: { channel: () => channel, removeChannel: () => { removed++; } } },
  '@/models/repositories/BookingRepository': { BookingRepository: class { findById() { return readBooking(); } } },
  './RidePaymentService': { RidePaymentService: class { getForBooking() { return readProof(); } } },
};
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/models/services/RidePaymentSyncService.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
 { exports: out, require: name => { assert.ok(deps[name], name); return deps[name]; }, setInterval: (fn, ms) => { assert.equal(ms, 3000); tick = fn; return 1; }, clearInterval: () => { cleared++; } });
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
 const changes = [];
 const observer = out.watchRidePayment('ride', (p, b) => changes.push([p, b]));
 await flush();
 assert.equal(changes.at(-1)[0].status, 'pending');
 assert.equal(events[0].filter.filter,'booking_id=eq.ride');
 assert.equal(events[1].filter.filter,'id=eq.ride');
 proof = { status: 'verified' }; booking = { id: 'ride', payment_status: 'completed' };
 await events[0].fn();
 assert.equal(changes.at(-1)[0].status,'verified');
 assert.equal(changes.at(-1)[1].payment_status,'completed');
 proof = { status: 'rejected', rejection_reason: 'Wrong receipt' };
 tick(); await flush(); assert.equal(changes.at(-1)[0].status,'rejected');
 proof = { status: 'verified' }; reconnect('SUBSCRIBED'); await flush();
 assert.equal(changes.at(-1)[0].status,'verified');
 let release;
 readProof = () => new Promise(resolve => { release = resolve; });
 const count = changes.length;
 void observer.refresh();
 tick(); // Slow requests must not be continually invalidated by polling.
 release({ status: 'pending' }); await flush();
 assert.equal(changes.length, count + 1);
 void observer.refresh();
 readProof = async () => ({ status: 'verified' });
 void events[1].fn();
 const before = changes.length;
 release({ status: 'pending' }); await flush();
 assert.equal(changes.length,before + 1);
 assert.equal(changes.at(-1)[0].status,'verified');
 readProof = async () => { throw Error('offline'); };
 await observer.refresh(); assert.equal(changes.length,before + 1);
 readProof = () => new Promise(resolve => { release = resolve; });
 void observer.refresh(); observer.stop(); release({ status: 'rejected' }); await flush();
 assert.equal(changes.length,before + 1);
 assert.equal(removed,1); assert.equal(cleared,1);
 console.log('PASS payment/booking realtime reconciliation, polling, reconnect, slow network, stale results, error retention and cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
