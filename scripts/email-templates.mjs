// Branded HTML for Supabase Auth emails. Email clients ignore <style> blocks
// and most modern CSS, so everything is table-based with inline styles.
// {{ .Token }} and {{ .Email }} are filled in by Supabase Auth.

const BRAND = '#3B634E';
const BRAND_DARK = '#2A4638';
const LEAF = '#E7F4E0';
const TEXT = '#1F2D25';
const MUTED = '#6B7280';

const codeEmail = ({ preheader, heading, intro, footnote }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#F2F7F0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F7F0;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E0E8E1;">
        <tr>
          <td style="background-color:${BRAND};background-image:linear-gradient(135deg,${BRAND_DARK},${BRAND});padding:28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:40px;height:40px;background-color:rgba(255,255,255,0.16);border-radius:20px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">&#128762;</td>
                <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">Smart Trike</div>
                  <div style="font-size:12px;color:#CFE6C6;">Boac, Marinduque</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:30px;color:${TEXT};font-weight:700;">${heading}</h1>
            <p style="margin:0;font-size:15px;line-height:23px;color:#3F4A44;">${intro}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${LEAF};border-radius:12px;">
              <tr>
                <td align="center" style="padding:22px 16px;font-family:'Courier New',Courier,monospace;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:${BRAND};font-weight:700;margin-bottom:8px;">YOUR VERIFICATION CODE</div>
                  <div style="font-size:36px;line-height:44px;letter-spacing:10px;font-weight:700;color:${BRAND_DARK};">{{ .Token }}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:14px;line-height:21px;color:#3F4A44;">&#9201;&#65039; This code expires in <strong>10 minutes</strong> and can only be used once.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;padding:14px 16px;background-color:#FFF6E0;border-radius:10px;font-size:13px;line-height:20px;color:#6B4E00;">&#128274; Never share this code. Smart Trike staff will never ask for it. ${footnote}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #EDF2ED;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:18px;color:${MUTED};">This email was sent to {{ .Email }}.<br>Smart Trike · FEDTODAB · Boac, Marinduque</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

export const emailTemplates = {
  confirmation: {
    subject: 'Your Smart Trike verification code',
    html: codeEmail({
      preheader: 'Enter this code in the Smart Trike app to create your account.',
      heading: 'Verify your email',
      intro: 'Welcome to Smart Trike! Enter the code below in the app to finish creating your account.',
      footnote: 'If you did not sign up for Smart Trike, you can ignore this email — no account will be created.',
    }),
  },
  recovery: {
    subject: 'Your Smart Trike password-reset code',
    html: codeEmail({
      preheader: 'Enter this code in the Smart Trike app to reset your password.',
      heading: 'Reset your password',
      intro: 'We received a request to reset your Smart Trike password. Enter the code below in the app to choose a new one.',
      footnote: 'If you did not request a password reset, you can ignore this email — your password stays the same.',
    }),
  },
  reauthentication: {
    subject: 'Your Smart Trike security code',
    html: codeEmail({
      preheader: 'Enter this code in the Smart Trike app to confirm the change to your account.',
      heading: 'Confirm it’s you',
      intro: 'Enter the code below in the Smart Trike app to confirm the change to your password.',
      footnote: 'If you did not try to change your password, sign in and change it right away.',
    }),
  },
};
