const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const sharp = require("sharp");
const fs = require("fs").promises;

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

/* ================= UPLOAD MEDIA ================= */
const Uploadmedia = async (filePath) => {
  try {
    // 1️⃣ Resize only (no format conversion)
    const buffer = await sharp(filePath)
      .resize({ width: 1920, withoutEnlargement: true })
      .toBuffer();

    // 2️⃣ Upload buffer to Cloudinary
    const uploadResponse = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "uploads",
          resource_type: "image",
          quality: "auto",
          fetch_format: "auto",
          timeout: 60000,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(buffer);
    });

    return uploadResponse;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  } finally {
    // 3️⃣ Cleanup original file (multer)
    await fs.unlink(filePath).catch(() => null);
  }
};

/* ================= DELETE MEDIA ================= */
const deletemedia = async (publicId, resourceType = "image") => {
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error("Error deleting media:", error);
    throw error;
  }
};

module.exports = { Uploadmedia, deletemedia };
