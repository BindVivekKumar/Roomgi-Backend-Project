const Certificate = require("../../model/certificate");
const uuid = require("uuid")
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const path = require("path");

exports.createCertificate = async (req, res) => {
  try {
    const {
      name,
      role,
      startDate,
      endDate,
      type,
      amount
    } = req.body;



    const prefix = "CERT-ROOMGI";
    const year = new Date().getFullYear();
    const unique = crypto.randomUUID().slice(0, 6).toUpperCase();

    const certificateId = `${prefix}-${year}-${unique}`;
    const qrLink = `https://www.roomgi.com/certificates?id=${certificateId}`;


    const certificate = await Certificate.create({
      name,
      role,
      startDate,
      endDate,
      type,
      amount,
      certificateId: certificateId,
      qrLink: qrLink
    });




    res.status(201).json({
      success: true,
      message: "Certificate created successfully",
      data: certificate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating certificate",
      error: error.message
    });
  }
};
exports.getAllCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching certificates",
      error: error.message
    });
  }
};
exports.updateCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOneAndUpdate(
      { certificateId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Certificate updated successfully",
      data: certificate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating certificate",
      error: error.message
    });
  }
};
exports.deleteCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOneAndDelete({ certificateId });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Certificate deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting certificate",
      error: error.message
    });
  }
};
exports.downloadCertificate = async (req, res) => {
  try {
    const id = req.query.id?.trim();
    const cert = await Certificate.findOne({ certificateId: id });

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Certificate_${cert.name.replace(/\s/g, "_")}.pdf`
    );

    doc.pipe(res);

    // 🎨 COLORS
    const primaryBlue = "#0B1E3C";
    const accentGold = "#C9A24D";
    const textGray = "#555555";
    const lightGray = "#F7F7F7";

    // 🟫 BACKGROUND
    doc.rect(0, 0, 842, 595).fill(lightGray);

    // 🟦 BORDER DESIGN (clean layered look)
    doc.rect(15, 15, 812, 565).lineWidth(2).stroke(accentGold);
    doc.rect(25, 25, 792, 545).lineWidth(1).stroke(primaryBlue);

    // ─────────────────────────────
    // 🏆 TITLE (TOP)
    doc
      .fillColor(primaryBlue)
      .font("Times-Bold")
      .fontSize(38)
      .text("CERTIFICATE OF INTERNSHIP", 0, 80, {
        align: "center",
      });

    // 📄 SUBTITLE
    doc
      .fillColor(textGray)
      .font("Times-Italic")
      .fontSize(16)
      .text("This is proudly presented to", 0, 130, {
        align: "center",
      });

    // 👤 NAME (MAIN FOCUS)
    doc
      .fillColor(primaryBlue)
      .font("Helvetica-Bold")
      .fontSize(34)
      .text(cert.name.toUpperCase(), 0, 165, {
        align: "center",
      });

    // ✨ UNDERLINE (NAME)
    doc
      .moveTo(250, 210)
      .lineTo(592, 210)
      .lineWidth(1.5)
      .stroke(accentGold);

    // 📌 ROLE DESCRIPTION
    doc
      .fillColor(textGray)
      .font("Times-Roman")
      .fontSize(15)
      .text(
        `has successfully completed internship as ${cert.role} at RoomGi Private Limited`,
        0,
        230,
        { align: "center", width: 700 }
      );

    // 📅 DATES
    const startDate = new Date(cert.startDate).toLocaleDateString("en-IN");
    const endDate = new Date(cert.endDate).toLocaleDateString("en-IN");

    doc
      .fontSize(14)
      .fillColor(primaryBlue)
      .text(`Duration: ${startDate} - ${endDate}`, 0, 280, {
        align: "center",
      });

    // 🔥 TYPE + STIPEND BOX STYLE
    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor(textGray)
      .text(`Internship Type: ${cert.type}`, 0, 310, {
        align: "center",
      });

    if (cert.type === "Paid") {
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(primaryBlue)
        .text(`Stipend: ${cert.amount} RS`, 0, 330, {
          align: "center",
        });
    }

    // ─────────────────────────────
    // ✍️ SIGNATURE SECTION (LEFT)
    const footerY = 440;

    doc
      .moveTo(90, footerY + 30)
      .lineTo(280, footerY + 30)
      .stroke(primaryBlue);

    doc
      .fillColor(primaryBlue)
      .font("Times-BoldItalic")
      .fontSize(16)
      .text("Anshu Raj", 90, footerY + 10);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(textGray)
      .text("Managing Director", 90, footerY + 35)
      .text("RoomGi Private Limited", 90, footerY + 48);

    // 🔳 QR CODE (RIGHT SIDE)
    const qrImage = await QRCode.toDataURL(cert.qrLink);

    doc.image(qrImage, 650, footerY - 10, { width: 85 });

    doc
      .fontSize(9)
      .fillColor(textGray)
      .text("Scan to Verify", 650, footerY + 75, {
        width: 85,
        align: "center",
      });

    // ─────────────────────────────
    // 📌 FOOTER BAR
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`Certificate ID: ${cert.certificateId}`, 40, 565);

    doc.text(
      `Issued On: ${new Date(cert.issueDate).toLocaleDateString("en-IN")}`,
      620,
      565
    );

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};
exports.ViewCertificates = async (req, res) => {
  try {
    const id = req.query.id?.trim();

    // ❌ No ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Certificate ID is required"
      });
    }

    // ✅ Case-insensitive match (BEST WAY)
    const certificate = await Certificate.findOne({
      certificateId: id.toUpperCase()
    });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    // ✅ Success
    res.status(200).json({
      success: true,
      data: certificate
    });

  } catch (error) {
    console.error("Verify Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// exports.downloadCertificate = async (req, res) => {
//   try {
//     const id = req.query.id?.trim();

//     if (!id) {
//       return res.status(400).json({ message: "Certificate ID required" });
//     }

//     const cert = await Certificate.findOne({ certificateId: id });

//     if (!cert) {
//       return res.status(404).json({ message: "Invalid Certificate" });
//     }

//     // 🔳 QR Generate (High quality)
//     const qrImage = await QRCode.toDataURL(cert.qrLink, {
//       errorCorrectionLevel: "H",
//       type: "image/png",
//     });

//     // 📄 Headers
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=${cert.name.replaceAll(" ", "_")}_certificate.pdf`
//     );

//     const doc = new PDFDocument({
//       size: "A4",
//       layout: "landscape",
//       margin: 50,
//     });

//     doc.pipe(res);

//     const pageWidth = doc.page.width;
//     const pageHeight = doc.page.height;

//     // 🟫 BORDER
//     doc
//       .lineWidth(2)
//       .rect(30, 30, pageWidth - 60, pageHeight - 60)
//       .stroke("#2c3e50");

//     // 🏆 TITLE
//     doc
//       .font("Helvetica-Bold")
//       .fontSize(30)
//       .fillColor("#2c3e50")
//       .text("Internship Completion Certificate", 0, 120, {
//         align: "center",
//       });

//     // 📄 SUBTITLE
//     doc
//       .moveDown(1)
//       .font("Helvetica")
//       .fontSize(16)
//       .fillColor("#555")
//       .text("This certifies that", { align: "center" });

//     // 👤 NAME
//     doc
//       .moveDown(1)
//       .font("Helvetica-Bold")
//       .fontSize(36)
//       .fillColor("#111")
//       .text(cert.name, { align: "center" });

//     // 📄 DESCRIPTION
//     const startDate = new Date(cert.startDate).toLocaleDateString("en-IN");
//     const endDate = new Date(cert.endDate).toLocaleDateString("en-IN");
//     const firstName = cert.name.split(" ")[0] || cert.name;

//     doc
//       .moveDown(0.6)
//       .font("Helvetica")
//       .fontSize(14)
//       .fillColor("#444")
//       .text(
//         `has successfully completed an internship at Roomgi Private Limited as a ${cert.role} from ${startDate} to ${endDate}. During this internship, ${firstName} ${cert.description || "demonstrated strong technical skills and dedication."
//         }`,
//         100,
//         null,
//         { align: "center", width: pageWidth - 200 }
//       );

//     // ─────────────────────────────
//     // 🔻 FOOTER GRID (CLEAN STRUCTURE)
//     const footerY = pageHeight - 170;

//     // 🔹 LEFT → Mentor
//     doc
//       .font("Helvetica-Bold")
//       .fontSize(12)
//       .fillColor("#222")
//      .text("Program Mentor", 80, footerY - 10); 

//     doc
//       .font("Helvetica")
//       .fontSize(11)
//       .fillColor("#555")
//       .text("Roomgi Private Limited", 80, footerY + 15);

//     // 🔹 RIGHT → Date + Certificate ID
//     const rightX = pageWidth - 220;

//     doc
//       .font("Helvetica")
//       .fontSize(11)
//       .fillColor("#333")
//       .text("Date of issue", rightX, footerY, {
//         width: 180,
//         align: "right",
//       });

//     doc
//       .font("Helvetica-Bold")
//       .text(
//         new Date(cert.issueDate).toLocaleDateString("en-IN"),
//         rightX,
//         footerY + 15,
//         { width: 180, align: "right" }
//       );

//     doc
//       .font("Helvetica")
//       .fontSize(10)
//       .fillColor("gray")
//       .text("Certificate ID", rightX, footerY + 35, {
//         width: 180,
//         align: "right",
//       });

//     doc
//       .font("Helvetica-Bold")
//       .fontSize(11)
//       .fillColor("black")
//       .text(cert.certificateId, rightX, footerY + 50, {
//         width: 180,
//         align: "right",
//       });

//     // ─────────────────────────────
//     // ─────────────────────────────
//     // 🔳 QR (LEFT BOTTOM ALIGN)
//     const qrSize = 55;      // same size
//     const qrMarginX = 80;   // left side gap
//     const qrMarginY = 80;   // bottom gap

//     doc.image(
//       qrImage,
//       qrMarginX,
//       pageHeight - qrMarginY - qrSize,
//       { width: qrSize }
//     );

//     // QR label (niche, left side)
//     doc
//       .fontSize(9)
//       .fillColor("#555")
//       .text(
//         "Scan to verify",
//         qrMarginX,
//         pageHeight - qrMarginY - 20,
//         {
//           width: qrSize,
//           align: "center",
//         }
//       );

//     doc.end();
//   } catch (err) {
//     console.error("PDF error:", err);

//     if (!res.headersSent) {
//       res.status(500).json({ message: "Server Error" });
//     }
//   }
// };