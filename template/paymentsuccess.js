const Mail = require("../utils/mail");

async function sendmailpaymentsuccess({
  email,
  username,
  branchName,
  roomNumber,
  amount,
  bookingId,
  dashboardUrl
}) {
  try {
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Confirmed - RoomGi</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #4f46e5, #6366f1); padding:25px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px;">
                🎉 Booking Confirmed!
              </h1>
              <p style="margin-top:6px; color:#e0e7ff; font-size:14px;">
                Welcome to RoomGi
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:15px; color:#333;">Hi <strong>${username}</strong>, 👋</p>

              <p style="font-size:15px; color:#555; line-height:1.6;">
                Your booking has been <strong>successfully confirmed</strong>.  
                Here are your booking details:
              </p>

              <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:20px; margin:20px 0;">
                <p style="margin:6px 0;"><strong>📍 Property:</strong> ${branchName}</p>
                <p style="margin:6px 0;"><strong>🛏 Room No:</strong> ${roomNumber}</p>
                <p style="margin:6px 0;"><strong>💰 Amount Paid:</strong> ₹${amount}</p>
                <p style="margin:6px 0;"><strong>🆔 Booking ID:</strong> ${bookingId}</p>
                <p style="margin:6px 0;"><strong>📅 Date:</strong> ${new Date().toDateString()}</p>
              </div>

              <div style="text-align:center; margin:30px 0;">
                <a href="${dashboardUrl}"
                  style="background:#4f46e5; color:white; padding:12px 26px; text-decoration:none; border-radius:8px; font-weight:bold;">
                  View Booking
                </a>
              </div>

              <p style="font-size:14px; color:#666;">
                📄 Invoice will be available in your dashboard.
              </p>

              <p style="font-size:14px; color:#999; margin-top:20px;">
                If you have any issues, contact us at  
                <a href="mailto:support@roomgi.com" style="color:#4f46e5; text-decoration:none;">
                  support@roomgi.com
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:15px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#888;">
                © ${new Date().getFullYear()} RoomGi. All rights reserved.
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
🎉 Booking Confirmed - RoomGi

Hi ${username},

Your booking has been successfully confirmed.

Property: ${branchName}
Room No: ${roomNumber}
Amount Paid: ₹${amount}
Booking ID: ${bookingId}
Date: ${new Date().toDateString()}

Login to your dashboard to view full details.

Need help? support@roomgi.com
`;

    await Mail(
      email,
      "🎉 Your RoomGi Booking is Confirmed!",
      htmlBody,
      textBody
    );
  } catch (error) {
    throw error;
  }
}

module.exports = sendPaymentSuccessMail;
