const crypto = require("crypto");
const Booking = require("../model/user/booking");

exports.razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== req.headers["x-razorpay-signature"]) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const payload = req.body.payload;

  if (event === "refund.processed") {
    const refund = payload.refund.entity;

    const booking = await Booking.findOne({
      "razorpay.paymentId": refund.payment_id,
    });

    if (booking) {
      booking.status = "refunded";
      booking.razorpay.refundId = refund.id;
      await booking.save();

      console.log("🎉 Refund confirmed by webhook:", refund.id);
    }
  }

  res.json({ received: true });
};
