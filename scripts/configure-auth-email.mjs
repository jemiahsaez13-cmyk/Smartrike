import { emailTemplates } from './email-templates.mjs';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const accessToken = required('SUPABASE_ACCESS_TOKEN');
const projectRef = required('SUPABASE_PROJECT_REF');
const smtpHost = required('AUTH_SMTP_HOST');
const smtpPort = required('AUTH_SMTP_PORT');
const smtpUser = required('AUTH_SMTP_USER');
const smtpPassword = required('AUTH_SMTP_PASSWORD');
const senderEmail = required('AUTH_SMTP_SENDER_EMAIL');
const senderName = process.env.AUTH_SMTP_SENDER_NAME || 'Smart Trike';
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

const patchConfig = async (body) => {
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Supabase Auth configuration failed (${response.status}).`);
  }
  return response.json();
};

// Configure SMTP first because hosted free-tier projects reject custom email
// templates while the default sender is active.
await patchConfig({
  smtp_host: smtpHost,
  smtp_port: smtpPort,
  smtp_user: smtpUser,
  smtp_pass: smtpPassword,
  smtp_admin_email: senderEmail,
  smtp_sender_name: senderName,
  smtp_max_frequency: 60,
});

const config = await patchConfig({
  external_email_enabled: true,
  external_phone_enabled: false,
  mailer_autoconfirm: false,
  sms_autoconfirm: false,
  mailer_otp_exp: 600,
  mailer_otp_length: 6,
  password_min_length: 8,
  password_required_characters: 'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789',
  security_update_password_require_reauthentication: true,
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_confirmation: emailTemplates.confirmation.subject,
  mailer_templates_confirmation_content: emailTemplates.confirmation.html,
  mailer_subjects_recovery: emailTemplates.recovery.subject,
  mailer_templates_recovery_content: emailTemplates.recovery.html,
  mailer_subjects_reauthentication: emailTemplates.reauthentication.subject,
  mailer_templates_reauthentication_content: emailTemplates.reauthentication.html,
});

const confirmationUsesCode = /\{\{\s*\.Token\s*\}\}/.test(
  config.mailer_templates_confirmation_content || ''
);
const recoveryUsesCode = /\{\{\s*\.Token\s*\}\}/.test(
  config.mailer_templates_recovery_content || ''
);

if (!confirmationUsesCode || !recoveryUsesCode) {
  throw new Error('Supabase accepted the request but did not retain the OTP email templates.');
}

console.log('SMTP and email verification-code templates are configured.');
