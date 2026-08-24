-- Migration 043: Add selected_payment_methods and appointment_date to franchise_applications
--
-- selected_payment_methods: JSONB array of AdminMtopPaymentMethod objects that
--   the admin selected when they clicked "Send Billing". Lets the driver see
--   the actual account numbers / QR codes / addresses on their FranchiseScreen
--   without making a separate query to admin_mtop_payment_methods.
--
-- appointment_date: ISO-8601 timestamp set when a driver books a face-to-face
--   payment appointment. Null until the driver submits the appointment form.

alter table franchise_applications
  add column if not exists selected_payment_methods jsonb,
  add column if not exists appointment_date timestamptz;

comment on column franchise_applications.selected_payment_methods is
  'Serialised array of AdminMtopPaymentMethod objects chosen by the admin at billing time.';

comment on column franchise_applications.appointment_date is
  'ISO-8601 datetime the driver booked for a face-to-face payment visit.';
