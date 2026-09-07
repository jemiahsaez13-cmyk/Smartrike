const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const deps = {
  '@reduxjs/toolkit': require('@reduxjs/toolkit'),
  '@/config/supabase': { supabase: {} },
  '@/models/services/NotificationService': { NotificationService: class {} },
};
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/controllers/slices/notificationSlice.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: out, require: name => deps[name] });
const { default: reduce, fetchNotifications: fetch, addNotification: add, clearNotifications: clear, markNotificationRead: read } = out;
const row = { id: 'notice', user_id: 'driver', type: 'violation', title: 'Violation recorded', body: 'Details', read: false, created_at: '2026-09-08T00:00:00Z' };
let state = reduce(undefined, fetch.pending('driver-request', 'driver'));
state = reduce(state, add(row));
state = reduce(state, add(row));
assert.equal(state.notifications.length, 1);
assert.equal(state.unreadCount, 1);
state = reduce(state, read(row.id));
assert.equal(state.unreadCount, 0);
state = reduce(state, add({ ...row, title: 'Violation resolved', body: 'Status: Resolved' }));
assert.equal(state.notifications[0].title, 'Violation resolved');
assert.equal(state.unreadCount, 1, 'Status update becomes unread without duplication');
assert.equal(state.notifications.length, 1);
state = reduce(state, add({ ...row, id: 'other', user_id: 'passenger' }));
assert.equal(state.notifications.length, 1, 'Other accounts cannot enter the active list');
state = reduce(state, fetch.pending('passenger-request', 'passenger'));
assert.equal(state.notifications.length, 0);
assert.equal(state.unreadCount, 0);
state = reduce(state, fetch.fulfilled([row], 'driver-request', 'driver'));
assert.equal(state.notifications.length, 0, 'Late previous-account fetch is ignored');
state = reduce(state, fetch.fulfilled([{ ...row, user_id: 'passenger' }], 'passenger-request', 'passenger'));
assert.equal(state.unreadCount, 1);
state = reduce(state, clear());
state = reduce(state, fetch.fulfilled([row], 'passenger-request', 'passenger'));
assert.equal(state.notifications.length, 0, 'Logout invalidates pending requests');
console.log('PASS: notification updates/read counts, deduplication, recipient isolation, account switching, and stale fetch protection.');
