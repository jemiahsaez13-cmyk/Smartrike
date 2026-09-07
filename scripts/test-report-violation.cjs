// Isolated PostgreSQL test; does not connect to the live database.
// Set PGLITE_MODULE to an installed @electric-sql/pglite package if needed.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const migration = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
const one = async sql => (await db.query(sql)).rows[0];
const convert = n => `SELECT public.record_report_violation('${id(n)}') AS id`;

(async () => {
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE TABLE users(id UUID PRIMARY KEY, user_type TEXT);
      CREATE TABLE bookings(id UUID PRIMARY KEY);
      CREATE TABLE franchise_applications(id UUID PRIMARY KEY);
      CREATE FUNCTION public.current_app_user_id() RETURNS UUID LANGUAGE sql AS $$ SELECT COALESCE(nullif(current_setting('test.subject_id', true), '')::uuid, '${id(1)}'::uuid) $$;
      CREATE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT current_setting('test.admin', true) = 'yes' $$;
      SELECT set_config('test.admin', 'yes', false);
      INSERT INTO users VALUES ('${id(1)}', 'admin'), ('${id(2)}', 'driver'), ('${id(3)}', 'passenger');
    `);
    await db.exec(migration('027_create_reports.sql'));
    const association = migration('035_passenger_franchise_inventory_reports.sql');
    const start = association.indexOf('CREATE TABLE IF NOT EXISTS public.driver_violations');
    const end = association.indexOf('--', start);
    await db.exec(association.slice(start, end));
    const sql = migration('065_link_reports_and_violations.sql');
    await db.exec(sql);
    await db.exec(sql); // Safe to apply twice.
    await db.exec(`INSERT INTO reports(id, reporter_id, reported_id, reporter_role, reason, details, created_at, status)
      VALUES ('${id(4)}', '${id(3)}', '${id(2)}', 'passenger', 'Overcharged fare', 'Charged twice', '2026-09-08', 'open'),
      ('${id(5)}', '${id(2)}', '${id(3)}', 'driver', 'No show', NULL, NOW(), 'open'),
      ('${id(6)}', '${id(3)}', '${id(2)}', 'passenger', 'Unsafe driving', NULL, NOW(), 'reviewed'),
      ('${id(7)}', '${id(3)}', '${id(2)}', 'passenger', 'Rude behavior', NULL, NOW(), 'dismissed');`);
    await db.exec('SET ROLE authenticated');
    const first = await one(convert(4));
    assert.equal((await one(convert(4))).id, first.id, 'Retries return the same violation');
    await db.exec('RESET ROLE');
    const record = await one(`SELECT * FROM driver_violations WHERE report_id = '${id(4)}'`);
    assert.equal(record.driver_id, id(2));
    assert.equal(record.description, 'Charged twice');
    assert.equal(record.created_by, id(1));
    assert.equal((await one(`SELECT status FROM reports WHERE id='${id(4)}'`)).status, 'actioned');
    assert.equal(Number((await one('SELECT count(*) AS count FROM driver_violations')).count), 1);
    await assert.rejects(db.exec(convert(5)), /Only reports against drivers/);
    await assert.rejects(db.exec(convert(7)), /Reopen the report/);
    await assert.rejects(db.exec(convert(99)), /Report not found/);
    await db.exec("SELECT set_config('test.admin', 'no', false); SET ROLE authenticated");
    await assert.rejects(db.exec(convert(6)), /Administrator permission required/);
    await db.exec("RESET ROLE; SELECT set_config('test.admin', 'yes', false)");
    // Force the second write to fail: the first insert must roll back too.
    await db.exec(`CREATE FUNCTION reject_report_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test update failure'; END $$;
      CREATE TRIGGER reject_report_update BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION reject_report_update();`);
    await assert.rejects(db.exec(convert(6)), /test update failure/);
    assert.equal(Number((await one(`SELECT count(*) AS count FROM driver_violations WHERE report_id='${id(6)}'`)).count), 0);
    assert.equal((await one(`SELECT status FROM reports WHERE id='${id(6)}'`)).status, 'reviewed');
    await db.exec('DROP TRIGGER reject_report_update ON reports');
    await db.exec(convert(6));
    assert.equal((await one(`SELECT status FROM reports WHERE id='${id(6)}'`)).status, 'actioned');
    const passengerMigration = migration('066_passenger_violations.sql');
    await db.exec(passengerMigration);
    await db.exec(passengerMigration);
    const passengerViolation = await one(convert(5));
    assert.equal((await one(convert(5))).id, passengerViolation.id);
    const passengerRecord = await one(`SELECT * FROM driver_violations WHERE report_id='${id(5)}'`);
    assert.equal(passengerRecord.passenger_id, id(3));
    assert.equal(passengerRecord.driver_id, null);
    assert.equal((await one(`SELECT status FROM reports WHERE id='${id(5)}'`)).status, 'actioned');
    await db.exec(`INSERT INTO driver_violations(passenger_id, violation_type) VALUES ('${id(3)}', 'No-show');
      INSERT INTO driver_violations(driver_id, violation_type) VALUES ('${id(2)}', 'Unsafe driving');`);
    await assert.rejects(db.exec(`INSERT INTO driver_violations(passenger_id, violation_type) VALUES ('${id(2)}', 'Wrong role')`), /does not match/);
    await assert.rejects(db.exec(`INSERT INTO driver_violations(driver_id, violation_type) VALUES ('${id(3)}', 'Wrong role')`), /does not match/);
    await assert.rejects(db.exec(`INSERT INTO driver_violations(driver_id, passenger_id, violation_type) VALUES ('${id(2)}', '${id(3)}', 'Both')`), /violation_exactly_one_subject/);
    await assert.rejects(db.exec(`INSERT INTO driver_violations(passenger_id, report_id, violation_type) VALUES ('${id(3)}', '${id(4)}', 'Wrong target')`), /reported user/);
    await db.exec("SELECT set_config('test.admin', 'no', false); SET ROLE authenticated");
    await assert.rejects(db.exec(convert(5)), /Administrator permission required/);
    await db.exec('RESET ROLE');
    await db.exec("SELECT set_config('test.admin', 'yes', false)");
    const notificationSchema = migration('003_create_locations_table.sql');
    await db.exec(notificationSchema.slice(notificationSchema.indexOf('CREATE TABLE notifications')));
    const notificationMigration = migration('067_violation_notifications.sql');
    await db.exec(notificationMigration);
    const countNotifications = async () => Number((await one('SELECT count(*) AS n FROM notifications')).n);
    const total = await countNotifications();
    assert.equal(total, Number((await one('SELECT count(*) AS n FROM driver_violations')).n));
    const driverNotice = await one(`SELECT * FROM notifications WHERE violation_id='${first.id}'`);
    assert.equal(driverNotice.user_id, id(2));
    assert.match(driverNotice.body, /Overcharged fare/);
    assert.match(driverNotice.body, /Charged twice/);
    assert.match(driverNotice.body, /Status: Open/);
    assert.equal((await one(`SELECT user_id FROM notifications WHERE violation_id='${passengerViolation.id}'`)).user_id, id(3));
    await db.exec(`UPDATE notifications SET read=true WHERE id='${driverNotice.id}'`);
    await db.exec(notificationMigration);
    assert.equal(await countNotifications(), total, 'Backfill is idempotent');
    assert.equal((await one(`SELECT read FROM notifications WHERE id='${driverNotice.id}'`)).read, true);
    await db.exec(`UPDATE driver_violations SET status='resolved', penalty='Warning' WHERE id='${first.id}'`);
    const updatedNotice = await one(`SELECT * FROM notifications WHERE id='${driverNotice.id}'`);
    assert.equal(updatedNotice.read, false);
    assert.equal(updatedNotice.title, 'Violation resolved');
    assert.match(updatedNotice.body, /Penalty \/ sanction: Warning/);
    assert.equal(await countNotifications(), total, 'Updates reuse the notification');
    await db.exec(`INSERT INTO reports(id, reporter_id, reported_id, reporter_role, reason) VALUES
      ('${id(8)}', '${id(2)}', '${id(3)}', 'driver', 'Unpaid fare')`);
    const newPassengerViolation = await one(convert(8));
    assert.equal((await one(`SELECT user_id FROM notifications WHERE violation_id='${newPassengerViolation.id}'`)).user_id, id(3));
    await one(convert(8));
    assert.equal(await countNotifications(), total + 1, 'Conversion retries do not duplicate notices');
    await db.exec(`INSERT INTO driver_violations(passenger_id, violation_type) VALUES ('${id(3)}', 'Manual passenger record')`);
    assert.equal(await countNotifications(), total + 2, 'Manual records notify too');
    await db.exec(`GRANT SELECT, UPDATE ON notifications TO authenticated;
      SELECT set_config('test.subject_id', '${id(2)}', false);
      SELECT set_config('test.admin', 'no', false); SET ROLE authenticated`);
    const ownRows = (await db.query('SELECT * FROM notifications')).rows;
    assert.ok(ownRows.length > 0 && ownRows.every(row => row.user_id === id(2)), 'Driver only reads own notifications');
    assert.equal((await db.query(`UPDATE notifications SET read=true WHERE user_id='${id(3)}' RETURNING id`)).rows.length, 0);
    await db.exec(`RESET ROLE; SELECT set_config('test.subject_id', '${id(3)}', false); SET ROLE authenticated`);
    const passengerRows = (await db.query('SELECT * FROM notifications')).rows;
    assert.ok(passengerRows.length > 0 && passengerRows.every(row => row.user_id === id(3)), 'Passenger only reads own notifications');
    await db.exec('UPDATE notifications SET read=true');
    assert.ok((await db.query('SELECT read FROM notifications')).rows.every(row => row.read));
    await db.exec('RESET ROLE');
    console.log('PASS: report conversion, duplicate retries, admin permissions, validation, reviewed reports, atomic rollback, repeatable migrations, passenger conversion, manual role validation, report target validation, recipient-only notifications, status updates, read persistence, and idempotent backfill.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
