const crypto = require("crypto");
const { paymentQueue } = require("../../queue");

exports.paymentWebhook = async (req, res) => {
  try {
    console.log("🔥 Razorpay Webhook Hit");

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || !signature) {
      return res.status(400).send("Missing secret or signature");
    }

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).send("Invalid body");
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      )
    ) {
      console.error("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event !== "payment.captured") {
      return res.status(200).json({ ignored: true });
    }

    const payment = event.payload.payment.entity;

    await paymentQueue.add(
      "paymentQueue",
      {
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
      },
      {
        attempts: 5,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: true,
      }
    );

    console.log("🚀 Job added to paymentQueue");
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 Webhook error:", err);
    res.status(500).send("Webhook error");
  }
};
