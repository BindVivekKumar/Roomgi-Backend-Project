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



    const prefix = "CERT-Roomgi";
    const year = new Date().getFullYear();
    const unique = crypto.randomUUID().slice(0, 6).toUpperCase();

    const certificateId = `${prefix}-${year}-${unique}`;
    const qrLink = `https://www.roomgi.com/certificate/verify?id=${certificateId}`;


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
    const lightGray = "#F9F9F9";
    const textGray = "#444444";

    // 🟫 BACKGROUND
    doc.rect(0, 0, 842, 595).fill(lightGray);

    // 🟦 BORDER
    doc.rect(20, 20, 802, 555).lineWidth(2).stroke(accentGold);
    doc.rect(30, 30, 782, 535).lineWidth(1).stroke(primaryBlue);

    // 🏢 HEADER
    doc
      .fillColor(primaryBlue)
      .font("Helvetica-Bold")
      .fontSize(35)
      .text("RoomGi", 0, 80, { align: "center", characterSpacing: 2 });

    doc
      .fillColor(accentGold)
      .fontSize(12)
      .font("Helvetica")
      .text("CREATIVE INTERNSHIP SOLUTIONS", 0, 120, { align: "center" });

    // 🏆 TITLE
    doc.moveDown(2);
    doc
      .fillColor(primaryBlue)
      .font("Times-Bold")
      .fontSize(42)
      .text("CERTIFICATE OF INTERNSHIP", { align: "center" });

    // 📄 SUBTITLE
    doc.moveDown(1);
    doc
      .fillColor(textGray)
      .font("Times-Italic")
      .fontSize(18)
      .text("This certificate is proudly presented to", {
        align: "center",
      });

    // 👤 NAME
    doc.moveDown(0.5);
    doc
      .fillColor(primaryBlue)
      .font("Helvetica-Bold")
      .fontSize(34)
      .text(cert.name.toUpperCase(), { align: "center" });

    // ✨ LINE
    doc.moveTo(250, 335).lineTo(592, 335).lineWidth(1).stroke(accentGold);

    // 📄 DESCRIPTION
    doc.moveDown(0.5);
    doc
      .fillColor(textGray)
      .font("Times-Roman")
      .fontSize(16)
      .text(
        `For successfully completing an internship as ${cert.role} at RoomGi Private Limited.`,
        { align: "center" }
      );

    // 📅 DATES
    const startDate = new Date(cert.startDate).toLocaleDateString("en-IN");
    const endDate = new Date(cert.endDate).toLocaleDateString("en-IN");

    doc
      .fontSize(14)
      .text(`Conducted from ${startDate} to ${endDate}`, {
        align: "center",
      });

    // 🔥 TYPE + STIPEND (NEW ADD)
    doc.moveDown(1);

    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor(primaryBlue)
      .text(`Internship Type: ${cert.type}`, {
        align: "center",
      });

    if (cert.type === "Paid") {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(`Stipend: ${cert.amount} rs`, {
          align: "center",
        });
    }

    // ─────────────────────────────
    // ✍️ SIGNATURE + QR
    const footerY = 460;

    // ✍️ SIGNATURE LINE
    doc
      .moveTo(80, footerY + 40)
      .lineTo(280, footerY + 40)
      .lineWidth(1)
      .stroke(primaryBlue);

    doc
      .fillColor(primaryBlue)
      .font("Times-BoldItalic")
      .fontSize(18)
      .text("Anshu Raj", 80, footerY + 15);

    doc
      .font("Helvetica")
      .fontSize(11)
      .text("Managing Director, RoomGi", 80, footerY + 45);

    // 🔳 QR CODE
    const qrImage = await QRCode.toDataURL(cert.qrLink);

    doc.image(qrImage, 650, footerY - 10, { width: 80 });

    doc
      .fillColor(textGray)
      .fontSize(9)
      .text("Scan to Verify", 650, footerY + 75, {
        width: 80,
        align: "center",
      });

    // ─────────────────────────────
    // 📌 FOOTER INFO
    doc
      .fillColor("#555")   
      .fontSize(9)
      .text(`ID: ${cert.certificateId}`, 40, 565);

    doc
      .text(
        `Issued: ${new Date(cert.issueDate).toLocaleDateString("en-IN")}`,
        700,
        565
      );

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.ViewCertificates = async (req, res) => {
  try {

    const id = req.query.id?.trim();
    console.log(id)
    const certificate = await Certificate.findOne({
      certificateId: new RegExp(`^${id}$`, "i")
    });
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }
    res.status(200).json({
      success: true,
      data: certificate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching certificates",
      error: error.message
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