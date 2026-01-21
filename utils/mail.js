// const nodemailer = require("nodemailer");


// const Mail = async (email, subject, htmlBody, textBody) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.MAIL_HOST,
//       port: process.env.MAIL_PORT || 587,
//       secure: false,
//       auth: {
//         user: process.env.MAIL_USER, // SMTP LOGIN
//         pass: process.env.MAIL_PASS, // SMTP KEY
//       },
//     });

//     const mailOptions = {
//       from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
//       to: email,
//       subject,
//       text: textBody,
//       html: htmlBody,
//     };

//     const result = await transporter.sendMail(mailOptions);
//     console.log("✅ Mail sent:", result.messageId);
//     return result;
//   } catch (error) {
//     console.error("❌ Mail sending failed:", error.message);
//     throw new Error("Email could not be sent. Please try again later.");
//   }
// };

// module.exports = Mail;

const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const Mail = async (email, subject, htmlBody, textBody) => {
  try {
    const sendSmtpEmail = {
      to: [{ email }],
      sender: {
        email: process.env.MAIL_FROM_EMAIL,
        name: process.env.MAIL_FROM_NAME,
      },
      subject,
      htmlContent: htmlBody,
      textContent: textBody,
    };

    const result = await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    console.log("✅ Mail sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("❌ FULL Brevo Error:", error?.response?.text || error.message);
    throw error;
  }
};


module.exports = Mail;

