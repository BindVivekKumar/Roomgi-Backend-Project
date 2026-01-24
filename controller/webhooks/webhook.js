const crypto = require("crypto");
const { paymentQueue } = require("../../queue");

exports.paymentWebhook = async (req, res) => {
  try {
    console.log("🔥 Razorpay Webhook Hit");

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("❌ Webhook secret missing");
      return res.status(500).send("Webhook secret not configured");
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      console.error("❌ Signature missing");
      return res.status(400).send("Signature missing");
    }

    // ✅ RAW BODY BUFFER
    const body = req.body;

    // ✅ Generate expected signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    // ✅ Safe comparison
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Webhook signature verified");

    // ✅ Parse event AFTER verification
    const event = JSON.parse(body.toString("utf8"));
    console.log("📦 Event received:", event.event);

    // ✅ Only process captured payments
    if (event.event !== "payment.captured") {
      console.log("ℹ️ Ignored event:", event.event);
      return res.status(200).json({ ignored: true });
    }

    const paymentEntity = event.payload.payment.entity;

    // ✅ Push ONLY required data to queue
    await paymentQueue.add(
      "paymentQueue",
      {
        razorpay_payment_id: paymentEntity.id,
        razorpay_order_id: paymentEntity.order_id,
      },
      {
        removeOnComplete: true,
        attempts: 3,
      }
    );

    console.log("🚀 Job pushed to paymentQueue");

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 Webhook Error:", err);
    res.status(500).send("Webhook error");
  }
};
