const crypto = require("crypto");
const { paymentQueue } = require("../queue");

exports.paymentWebhook = async (req, res) => {
  try {
    console.log("🔥 Webhook hit");

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    console.log("Secret loaded from env:", secret ? "✅ Yes" : "❌ No");

    // Get signature
    const signature = req.headers["x-razorpay-signature"];
    console.log("Received signature:", signature);

    // Use raw body for signature verification
    const body = req.rawBody || JSON.stringify(req.body);
    console.log("Raw body:", body);

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    console.log("Expected signature:", expectedSignature);

    // Check signature
    if (signature !== expectedSignature) {
      console.log("❌ Invalid signature");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    console.log("✅ Signature verified");

    // Parse event
    const event = req.body;
    console.log("Event received:", JSON.stringify(event, null, 2));

    // Add to queue
    console.log("Adding event to paymentQueue...");
    await paymentQueue.add("razorpay-event", { event });
    console.log("✅ Event added to queue");

    res.status(200).json({ success: true, message: "Webhook received" });
    console.log("✅ Response sent");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
