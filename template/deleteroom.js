const mail = require("../utils/mail");

async function sendDeleteRoomMail(toEmail, username, deletedRoomDetails) {
  try {
    // Array ko comma separated string mein badalne ke liye helper (taaki [object Object] na dikhe)
    const formatList = (arr) => (arr && arr.length > 0 ? arr.join(", ") : null);

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; }
    .wrapper { padding: 40px 15px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    .status-bar { height: 6px; background: linear-gradient(to right, #ef4444, #f87171); }
    .header { padding: 40px 20px; text-align: center; }
    .icon-circle { width: 70px; height: 70px; background: #fee2e2; border-radius: 50%; line-height: 75px; margin: 0 auto 20px; display: inline-block; font-size: 30px; }
    .content { padding: 0 40px 40px; }
    .greeting { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; text-align: center; }
    .subtext { font-size: 16px; color: #6b7280; text-align: center; margin-bottom: 32px; }
    .details-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .section-title { font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .label { color: #6b7280; font-weight: 500; }
    .value { color: #111827; font-weight: 600; text-align: right; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
    .btn { display: inline-block; background: #111827; color: #ffffff !important; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 10px; }
    @media (max-width: 480px) { .row { flex-direction: column; } .value { text-align: left; margin-top: 2px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="status-bar"></div>
      <div class="header">
        <div class="icon-circle">🗑️</div>
        <div class="greeting">Room Deleted</div>
        <p class="subtext">Hi ${username}, the room has been successfully removed from <strong>${deletedRoomDetails.branchName}</strong>.</p>
      </div>
      <div class="content">
        <div class="details-box">
          <div class="section-title">Core Details</div>
          <div class="row"><span class="label">Room Number</span><span class="value">#${deletedRoomDetails.roomNumber}</span></div>
          <div class="row"><span class="label">Category</span><span class="value">${deletedRoomDetails.category}</span></div>
          ${deletedRoomDetails.type !== "-" ? `<div class="row"><span class="label">Type</span><span class="value">${deletedRoomDetails.type}</span></div>` : ""}
          <div class="row">
            <span class="label">Price Details</span>
            <span class="value">
              ${deletedRoomDetails.price !== "-" ? `₹${deletedRoomDetails.price} (${deletedRoomDetails.renttype})` : `₹${deletedRoomDetails.rentperday}/Day`}
            </span>
          </div>
        </div>

        ${deletedRoomDetails.services.length > 0 ? `
        <div class="details-box">
          <div class="section-title">Amenities & Rules</div>
          <div class="row"><span class="label">Services</span><span class="value">${formatList(deletedRoomDetails.services)}</span></div>
          ${deletedRoomDetails.rules.length > 0 ? `<div class="row"><span class="label">Rules</span><span class="value">${formatList(deletedRoomDetails.rules)}</span></div>` : ""}
        </div>` : ""}

        <p style="text-align: center; font-size: 13px; color: #9ca3af;">If this was a mistake, please contact support immediately.</p>
        <div style="text-align: center;">
          <a href="https://roomgi.com/dashboard" class="btn">Login to Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin:0; font-weight:600; color:#4b5563;">RoomGi</p>
        <p style="margin:5px 0 0; font-size:12px; color:#9ca3af;">&copy; 2026 RoomGi Inc. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const textBody = `Room Deleted: Room #${deletedRoomDetails.roomNumber} has been removed from ${deletedRoomDetails.branchName}.`;

    await mail(toEmail, "Room Deleted Successfully - RoomGi", htmlBody, textBody);
    console.log("Deletion email sent successfully to:", toEmail);

  } catch (err) {
    console.error("Failed to send deletion email:", err);
  }
}

module.exports = sendDeleteRoomMail;