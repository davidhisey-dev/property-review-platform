import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApprovalEmail(to: string, name: string) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Your Account Has Been Approved',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to the Property Review Platform</h2>
        <p>Hi ${name},</p>
        <p>Great news — your contractor account has been verified and is now active.</p>
        <p>You can now sign in and access the full platform.</p>
        <p>Thank you for being part of our community.</p>
        <br/>
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
    subject: 'Update on Your Account Application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Application Update</h2>
        <p>Hi ${name},</p>
        <p>Thank you for applying to join the Property Review Platform.</p>
        <p>After reviewing your application, we were unable to verify your 
        account at this time for the following reason:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 1rem; 
          color: #555;">
          ${reason}
        </blockquote>
        <p>If you believe this decision was made in error, we welcome you to 
        reapply or reach out to us directly at 
          <a href="mailto:placeholder@placeholder.com">placeholder@placeholder.com</a>
        </p>
        <p>We appreciate your understanding and hope to welcome you to the 
        platform soon.</p>
      </div>
    `
  })
}

export async function sendPendingEmail(to: string, name: string) {
  await resend.emails.send({
    from: 'placeholder@placeholder.com',
    to,
    subject: 'Thank You for Registering',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for Trusting Us to Serve You</h2>
        <p>Hi ${name},</p>
        <p>We have received your application and your account is currently 
        under review.</p>
        <p>You will be contacted at this email address once your account 
        has been verified and is ready to use.</p>
        <p>If you have any questions in the meantime, please reach out to us at 
          <a href="mailto:placeholder@placeholder.com">placeholder@placeholder.com</a>
        </p>
        <br/>
        <p>We look forward to serving you.</p>
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