const express = require("express");
const router = express.Router();
const certificateController = require("../../controller/admin/certificate");

// 📄 Create Certificate
router.post("/create", certificateController.createCertificate);

// 🔍 Verify Certificate
router.get("/verify", certificateController.ViewCertificates);
router.get("/download", certificateController.downloadCertificate);
module.exports = router;