import { firstNameFrom } from '../utils/name.util';

/**
 * Central email copy. Every message shares one calm layout and a single legal
 * footer so brand/consistency never drifts between emails.
 *
 * Consumer brand: LAUPAY
 * Legal entity:   Ibrahim Lau Provision Shop
 */
const BRAND = {
  name: 'LAUPAY',
  legal: 'Ibrahim Lau Provision Shop',
  tagline: 'Everyday digital services. One simple flow.',
  indigo: '#171A4A',
  amber: '#F4B33F',
  muted: '#5B5E80',
  border: '#E6E7F0',
  surface: '#F4F5FA',
} as const;

export interface RenderedEmail {
  subject: string;
  html: string;
}

function layout(body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.surface};">
    <div style="font-family:Inter,Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;color:${BRAND.indigo};">
      <div style="font-size:18px;font-weight:800;letter-spacing:-.04em;margin-bottom:20px;">${BRAND.name}</div>
      <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:28px;">
        ${body}
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.7;color:${BRAND.muted};">
        <strong style="color:${BRAND.indigo};">${BRAND.name}</strong><br />
        A service of ${BRAND.legal}<br />
        ${BRAND.tagline}
      </div>
    </div>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${BRAND.muted};">${text}</p>`;
}

/** Registration email-verification code. */
export function verificationEmail(fullName: string, code: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Thank you for creating a LAUPAY account.')}
    ${paragraph('Use this code to verify your email and finish setting up your account:')}
    <div style="background:${BRAND.amber};color:${BRAND.indigo};font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;padding:16px;border-radius:12px;margin:0 0 16px;">${code}</div>
    ${paragraph('This code expires in 10 minutes.')}
    ${paragraph('If you did not request this, you can safely ignore this email. Your account will not be activated.')}
  `;
  return { subject: 'Your LAUPAY verification code', html: layout(body) };
}

/** Password-reset link email. */
export function passwordResetEmail(fullName: string, resetUrl: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('We received a request to reset the password for your LAUPAY account.')}
    <div style="margin:0 0 16px;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND.indigo};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;">Reset your password</a>
    </div>
    ${paragraph('This link expires in 30 minutes.')}
    ${paragraph('If you did not request this, you can safely ignore this email. Your password will not change.')}
  `;
  return { subject: 'Reset your LAUPAY password', html: layout(body) };
}

/** Sent once, after the email is verified and the account becomes active. */
export function welcomeEmail(fullName: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Your email is verified and your LAUPAY account is ready.')}
    ${paragraph('You can now fund your wallet and start using airtime, data and payments.')}
    ${paragraph('Thanks for choosing LAUPAY.')}
  `;
  return { subject: 'Welcome to LAUPAY', html: layout(body) };
}
