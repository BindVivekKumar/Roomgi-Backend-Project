const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    role: {
      type: String,
      required: true
    },

    company: {
      type: String,
      required: true
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    duration: {
      type: String
      // e.g. "3 Months"
    },

    certificateId: {
      type: String,
      required: true,
      unique: true
    },

    qrLink: {
      type: String,
      required: true
    },

    issueDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

/**
 * 🔹 Auto-calculate duration before saving
 */
CertificateSchema.pre("save", function (next) {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  this.duration = `${months} Month${months > 1 ? "s" : ""}`;
  next();
});

module.exports = mongoose.model("Certificate", CertificateSchema);
