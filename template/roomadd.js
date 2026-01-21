const mail = require("../utils/mail");

async function sendaddroommail(toEmail, username, roomNumber, branchName, category, capacity, city) {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .label { color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
          .value { color: #111827; font-size: 15px; font-weight: 600; text-align: right; }
          .status-badge { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <div style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                
                <div style="background-color: #4f46e5; height: 6px;"></div>
                
                <div style="padding: 40px 32px;">
                  <div style="margin-bottom: 24px;">
                    <span style="font-size: 22px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px;">RoomGi</span>
                  </div>

                  <div class="status-badge">Action Required: Verification Pending</div>
                  
                  <h2 style="font-size: 24px; color: #111827; margin: 0 0 12px 0; font-weight: 700;">Room Details Submitted</h2>
                  <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                    Hello ${username}, your room details for <strong>${branchName}</strong> have been received. 
                  </p>

                  <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #f1f5f9;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td class="label">Room Number</td>
                        <td class="value">${roomNumber}</td>
                      </tr>
                      <tr>
                        <td class="label">Category</td>
                        <td class="value">${category}</td>
                      </tr>
                      <tr>
                        <td class="label">Capacity</td>
                        <td class="value">${capacity} Guests</td>
                      </tr>
                      <tr>
                        <td class="label">Location</td>
                        <td class="value">${city}</td>
                      </tr>
                    </table>
                  </div>

                  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
                      <strong>Note:</strong> Your room will be listed publicly after the verification process is complete. This usually takes <strong>within 24 hours</strong>.
                    </p>
                  </div>

                  <div style="text-align: center;">
                    <a href="https://www.roomgi.com/dashboard" 
                       style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
                       Check Status in Dashboard
                    </a>
                  </div>
                </div>

                <div style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #f3f4f6; text-align: center;">
                  <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                    Need help? Contact <a href="mailto:support@roomgi.com" style="color: #4f46e5; text-decoration: none;">support@roomgi.com</a>
                  </p>
                  <p style="font-size: 12px; color: #d1d5db; margin: 8px 0 0 0;">
                    &copy; ${new Date().getFullYear()} RoomGi Inc. All rights reserved.
                  </p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textBody = `Hello ${username}, your room (${roomNumber}) has been added. Note: It will be listed after verification is completed within 24 hours. Manage it here: https://www.roomgi.com/dashboard`;

    await mail(toEmail, "Room Submission Received - RoomGi", htmlBody, textBody);
    console.log("Professional room added (pending verification) email sent to:", toEmail);
  } catch (err) {
    console.error("Failed to send add room email:", err);
  }
}



module.exports = sendaddroommail;
