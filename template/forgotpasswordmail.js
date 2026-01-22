const mail = require("../utils/mail");

const sendForgotPasswordMail = async (to, username, resetLink) => {
  const subject = `Reset Your Roomgi Account Password`;

  const htmlBody = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Reset Your Password</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="550" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.06);">
              
              <tr>
                <td style="background:linear-gradient(90deg, #2563eb, #3b82f6); height:6px;"></td>
              </tr>

              <tr>
                <td style="padding:40px 32px;">

                  <h1 style="margin:0 0 16px; font-size:24px; font-weight:700; color:#111827; text-align:center;">
                    Reset your Roomgi password
                  </h1>
                  
                  <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:#4b5563; text-align:center;">
                    Hello <strong>${username}</strong>,<br/>
                    We received a request to reset your <strong>Roomgi</strong> account password.
                    You can reset it safely using the button below.
                  </p>

                  <div style="text-align:center; margin-bottom:32px;">
                    <a href="${resetLink}" target="_blank"
                      style="display:inline-block; padding:14px 32px; background-color:#2563eb; color:#ffffff; text-decoration:none; border-radius:8px; font-size:16px; font-weight:600; box-shadow:0 4px 6px rgba(37, 99, 235, 0.2);">
                      Reset Password
                    </a>
                  </div>

                  <div style="background-color:#fff7ed; border-left:4px solid #f97316; padding:12px 16px; margin-bottom:24px;">
                    <p style="margin:0; font-size:13px; color:#9a3412; line-height:1.5;">
                      <strong>Security Alert:</strong> This password reset link is valid for
                      <strong>30 minutes</strong>.  
                      If you did not request this, please ignore this email — your account is safe.
                    </p>
                  </div>

                  <p style="margin:0 0 8px; font-size:13px; color:#9ca3af; text-align:center;">
                    If the button doesn’t work, copy and paste this link into your browser:
                  </p>
                  <p style="margin:0; font-size:13px; color:#2563eb; text-align:center; word-break:break-all;">
                    <a href="${resetLink}" style="color:#2563eb; text-decoration:underline;">
                      ${resetLink}
                    </a>
                  </p>
                </td>
              </tr>

              <tr>
                <td style="background-color:#f9fafb; padding:24px; border-top:1px solid #e5e7eb; text-align:center;">
                  <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#374151;">
                    Roomgi
                  </p>
                  <p style="margin:0 0 16px; font-size:12px; color:#6b7280;">
                    Find your perfect PG, Hostel & Rental Home with ease.
                  </p>
                  
                  <div style="font-size:12px; color:#9ca3af;">
                    © ${new Date().getFullYear()} Roomgi. All rights reserved.
                  </div>
                </td>
              </tr>
            </table>
            
            <p style="margin-top:24px; font-size:13px; color:#6b7280; text-align:center;">
              Need help? 
              <a href="mailto:support@roomgi.com" style="color:#2563eb; text-decoration:none;">
                Contact Roomgi Support
              </a>
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const textBody = `
Hi ${username},

We received a request to reset your Roomgi account password.

Reset your password using the link  below (valid for 30 minutes):
${resetLink}

If you didn’t request this, you can safely ignore this email.

– Team Roomgi
`;

  await mail(to, subject, htmlBody, textBody);
};

module.exports = sendForgotPasswordMail;
