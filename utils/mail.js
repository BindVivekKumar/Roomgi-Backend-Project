

const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const Mail = async (email, subject, htmlBody, textBody) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Smart Resume Review" <${process.env.MAIL_USER}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    };

    const result = await transporter.sendMzail(mailOptions);

    console.log("✅ Mail sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("❌ FULL Brevo Error:", error?.response?.text || error.message);
    throw error;
  }
};


module.exports = Mail;

