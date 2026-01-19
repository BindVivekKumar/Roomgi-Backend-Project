const Certificate = require("../../model/certificate");
const uuid =require("uuid")
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");



exports.createCertificate = async (req, res) => {
  try {
    const {
      name,
      role,
      company,
      startDate,
      endDate
    } = req.body;

    const certificateId = crypto.randomUUID();
    const qrLink = `https://www.roomgi.com/certificate-verify/${certificateId}`;


    const certificate = await Certificate.create({
      name,
      role,
      company,
      startDate,
      endDate,
      certificateId:certificateId,
      qrLink:qrLink
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
exports.generateInternshipCertificatePDF = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const cert = await Certificate.findOne({ certificateId });

    if (!cert) return res.status(404).json({ message: "Certificate not found" });

    // 1. SET LANDSCAPE SIZE (Best for Certificates)
    const doc = new PDFDocument({ 
      size: "A4", 
      layout: "landscape", 
      margin: 0 
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Certificate_${cert.name.replace(/\s/g, '_')}.pdf`);
    doc.pipe(res);

    // --- COLORS & STYLES ---
    const primaryBlue = "#0B1E3C";    // Navy Blue
    const accentGold = "#C9A24D";     // Gold
    const lightGray = "#F9F9F9";      // Background
    const textGray = "#444444";       // Body text

    // 2. BACKGROUND & BORDER
    doc.rect(0, 0, 842, 595).fill(lightGray); // A4 Landscape width is 842pt
    
    // Elegant Double Border
    doc.rect(20, 20, 802, 555).lineWidth(2).stroke(accentGold);
    doc.rect(30, 30, 782, 535).lineWidth(1).stroke(primaryBlue);

    // Decorative Corner Elements (UX Touch)
    doc.fillColor(primaryBlue).rect(0, 0, 150, 40).fill(); // Top-left accent
    doc.fillColor(accentGold).rect(692, 555, 150, 40).fill(); // Bottom-right accent

    // 3. HEADER / LOGO SECTION
    doc.fillColor(primaryBlue)
       .font("Helvetica-Bold")
       .fontSize(35)
       .text("RoomGi", 0, 80, { align: "center", characterSpacing: 2 });
    
    doc.fillColor(accentGold)
       .fontSize(12)
       .font("Helvetica")
       .text("CREATIVE INTERNSHIP SOLUTIONS", 0, 120, { align: "center" });

    // 4. MAIN TITLE
    doc.moveDown(2);
    doc.fillColor(primaryBlue)
       .font("Times-Bold")
       .fontSize(42)
       .text("CERTIFICATE OF INTERNSHIP", { align: "center" });

    // 5. BODY CONTENT (Structured for readability)
    doc.moveDown(1);
    doc.fillColor(textGray)
       .font("Times-Italic")
       .fontSize(18)
       .text("This certificate is proudly presented to", { align: "center" });

    doc.moveDown(0.5);
    doc.fillColor(primaryBlue)
       .font("Helvetica-Bold")
       .fontSize(34)
       .text(cert.name.toUpperCase(), { align: "center" });

    // Horizontal line under name
    doc.moveTo(250, 335).lineTo(592, 335).lineWidth(1).stroke(accentGold);

    doc.moveDown(1.5);
    doc.fillColor(textGray)
       .font("Times-Roman")
       .fontSize(16)
       .text(
         `For successfully completing an internship as ${cert.role} at ${cert.company}.`,
         { align: "center" }
       );
    
    doc.fontSize(14)
       .text(
         `Conducted from ${cert.startDate.toLocaleDateString()} to ${cert.endDate.toLocaleDateString()}`,
         { align: "center" }
       );

    // 6. SIGNATURE & QR CODE (Side-by-Side Layout)
    const footerY = 460;

    // Left: Authorized Signatory
    doc.moveTo(80, footerY + 40).lineTo(280, footerY + 40).lineWidth(1).stroke(primaryBlue);
    doc.fillColor(primaryBlue).font("Times-BoldItalic").fontSize(18).text("Rahul Verma", 80, footerY + 15);
    doc.font("Helvetica").fontSize(11).text("Managing Director, RoomGi", 80, footerY + 45);

    // Middle: Official Seal (Visual Placeholder)
    doc.circle(421, footerY + 30, 40).lineWidth(1).dash(5, { space: 2 }).stroke(accentGold);
    doc.undash().fillColor(accentGold).fontSize(10).text("OFFICIAL\nSEAL", 400, footerY + 22, { align: "center" });

    // Right: QR Code for Verification
    const qrImage = await QRCode.toDataURL(cert.qrLink);
    doc.image(qrImage, 650, footerY - 10, { width: 80 });
    doc.fillColor(textGray).fontSize(8).text("Scan to Verify", 665, footerY + 75);

    // 7. FINAL FOOTER INFO
    doc.fillColor("#999")
       .fontSize(9)
       .text(`ID: ${cert.certificateId}`, 40, 565)
       .text(`Issued: ${cert.issueDate.toDateString()}`, 700, 565);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
