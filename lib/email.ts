import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApprovalEmail(to: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://propertyreviewplatform.com'
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Application Approved — Property Review Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Approved</h2>
        <p>Hi ${name},</p>
        <p>Your application has been approved. You can now sign in at
          <a href="${appUrl}">${appUrl}</a> to access the platform.
        </p>
        <p>If you have any questions, contact us at
          <a href="mailto:placeholder@placeholder.com">placeholder@placeholder.com</a>
        </p>
      </div>
    `
  })
}

export async function sendRejectionEmail(
  to: string, 
  name: string, 
  reason: string
) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Application Update — Property Review Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Update</h2>
        <p>Hi ${name},</p>
        <p>After reviewing your application we are unable to approve it at this time.</p>
        <p>Reason:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 1rem; color: #555;">
          ${reason}
        </blockquote>
        <p>You may reapply at any time.</p>
        <p>If you have any questions, contact us at
          <a href="mailto:placeholder@placeholder.com">placeholder@placeholder.com</a>
        </p>
      </div>
    `
  })
}

export async function sendPendingEmail(to: string, name: string) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Application Received — Property Review Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Received</h2>
        <p>Hi ${name},</p>
        <p>We have received your application and will review it within 1–2 business days.
        We will notify you by email once a decision has been made.</p>
        <p>If you have any questions in the meantime, please reach out to us at
          <a href="mailto:placeholder@placeholder.com">placeholder@placeholder.com</a>
        </p>
      </div>
    `
  })
  
}

export async function sendSuspensionEmail(
  to: string,
  name: string,
  reason: string
) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Your Account Has Been Suspended',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Suspension Notice</h2>
        <p>Hi ${name},</p>
        <p>Your account on the Property Review Platform has been suspended 
        for the following reason:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 1rem; 
          color: #555;">
          ${reason}
        </blockquote>
        <p>If you believe this decision was made in error, please contact 
        us at 
          <a href="mailto:placeholder@placeholder.com">
            placeholder@placeholder.com
          </a>
        </p>
      </div>
    `
  })
}

export async function sendReactivationEmail(to: string, name: string) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Your Account Has Been Reactivated',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Reactivated</h2>
        <p>Hi ${name},</p>
        <p>Your account on the Property Review Platform has been reactivated 
        and you now have full access to the platform.</p>
        <p>If you have any questions, contact us at 
          <a href="mailto:placeholder@placeholder.com">
            placeholder@placeholder.com
          </a>
        </p>
      </div>
    `
  })
}