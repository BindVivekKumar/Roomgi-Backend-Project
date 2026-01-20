const Mail = require("../utils/mail");

async function sendOtpMail(email, otp) {
  try {
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>OTP Verification</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#4f46e5; padding:20px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px;">
                Roomgi Security Verification
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:15px; color:#333;">Hello 👋</p>

              <p style="font-size:15px; color:#555; line-height:1.6;">
                We received a request to verify your email address.
                Please use the OTP below to continue:
              </p>

              <div style="margin:30px 0; text-align:center;">
                <span style="
                  display:inline-block;
                  font-size:28px;
                  letter-spacing:6px;
                  font-weight:bold;
                  color:#4f46e5;
                  background:#eef2ff;
                  padding:15px 25px;
                  border-radius:8px;">
                  ${otp}
                </span>
              </div>

              <p style="font-size:14px; color:#555;">
                ⏱ This OTP is valid for <strong>5 minutes</strong>.
                Do not share it with anyone.
              </p>

              <p style="font-size:14px; color:#999; margin-top:25px;">
                If you did not request this, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:15px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#888;">
                © ${new Date().getFullYear()} Roomgi. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textBody = `
Roomgi OTP Verification

Your OTP is: ${otp}

This OTP is valid for 5 minutes.
Do not share it with anyone.

If you did not request this, please ignore this email.
`;

    await Mail(
      email,
      "Your OTP for Roomgi Verification",
      htmlBody,
      textBody
    );

   
  } catch (error) {
        throw error;
  }
}

module.exports = sendOtpMail;
