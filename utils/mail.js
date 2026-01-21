const nodemailer = require("nodemailer");


const Mail = async (email, subject, htmlBody, textBody) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER, // SMTP LOGIN
        pass: process.env.MAIL_PASS, // SMTP KEY
      },
    });

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Mail sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("❌ Mail sending failed:", error.message);
    throw new Error("Email could not be sent. Please try again later.");
  }
};

module.exports = Mail;
