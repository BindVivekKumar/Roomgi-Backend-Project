const express = require("express");
const router = express.Router();
const certificateController = require("../../controller/owner/certificate");

router.post("/create", certificateController.createCertificate);
router.get("/:certificateId", certificateController.generateInternshipCertificatePDF);
router.get("/", certificateController.getAllCertificates);
router.put("/:certificateId", certificateController.updateCertificate);
router.delete("/:certificateId", certificateController.deleteCertificate);

module.exports = router;
