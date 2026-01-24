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

    /* ✅ THIS MUST BE BUFFER */
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      console.error("❌ Raw body is not buffer");
      return res.status(400).send("Invalid body");
    }

    /* ✅ Generate expected signature */
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    /* ✅ Timing-safe comparison */
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      )
    ) {
      console.error("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Webhook signature verified");

    /* ✅ Parse JSON AFTER verification */
    const event = JSON.parse(rawBody.toString("utf8"));
    console.log("📦 Event:", event.event);

    /* ✅ Only handle captured payments */
    if (event.event !== "payment.captured") {
      console.log("ℹ️ Ignored event:", event.event);
      return res.status(200).json({ ignored: true });
    }

    const payment = event.payload.payment.entity;

    await paymentQueue.add(
      "paymentQueue",
      {
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
      },
      { attempts: 3, removeOnComplete: true }
    );

    console.log("🚀 Job added to paymentQueue");

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("🔥 Webhook Error:", error);
    res.status(500).send("Webhook error");
  }
};




// const crypto = require("crypto");
// const { paymentQueue } = require("../queue");
// const Booking = require("../model/user/booking");

// exports.paymentWebhook = async (req, res) => {
//   try {
//     console.log("🔥 Webhook hit");

//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     if (!secret) console.log("❌ Webhook secret missing in env");

//     // Get signature
//     const signature = req.headers["x-razorpay-signature"];
//     if (!signature) console.log("❌ Signature missing in headers");

//     // Use raw body for verification
//     const body = req.rawBody || JSON.stringify(req.body);

//     // Generate expected signature
//     const expectedSignature = crypto
//       .createHmac("sha256", secret)
//       .update(body)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       console.log("❌ Invalid signature");
//       return res.status(400).json({ success: false, message: "Invalid signature" });
//     }
//     console.log("✅ Signature verified");

//     // Event payload
//     const event = req.body;
//     console.log("Event received:", JSON.stringify(event, null, 2));

//     // Handle Refund events immediately (optional)
//     if (
//       event.event === "payment.refund.processed" ||
//       event.event === "payment.refund.failed"
//     ) {
//       const paymentId = event.payload.payment.entity.id;
//       const booking = await Booking.findOne({ "razorpay.paymentId": paymentId });

//       if (!booking) {
//         console.log("❌ Booking not found for refund event:", paymentId);
//       } else {
//         if (event.event === "payment.refund.processed") {
//           booking.status = "refunded";
//           booking.razorpay.refundId = event.payload.refund.entity.id;
//           await booking.save();
//           console.log("✅ Refund processed and updated in DB:", booking._id);
//         } else if (event.event === "payment.refund.failed") {
//           booking.status = "refunded_failed";
//           await booking.save();
//           console.log("❌ Refund failed in Razorpay, DB updated:", booking._id);
//         }
//       }
//     }

//     // Add all events to queue for further async processing
//     await paymentQueue.add("razorpay-event", { event });
//     console.log("✅ Event added to queue");

//     res.status(200).json({ success: true, message: "Webhook received" });
//   } catch (error) {
//     console.error("Webhook Error:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };
