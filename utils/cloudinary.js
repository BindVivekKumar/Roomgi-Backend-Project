const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const TEMP_DIR = path.join(__dirname, 'temp');

// ----------- Upload with compression -----------
const Uploadmedia = async (filePath) => {
  let compressedPath = null;

  try {
    // 1. Ensure temp directory exists
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const fileName = `compressed-${Date.now()}-${path.basename(filePath)}`;
    compressedPath = path.join(TEMP_DIR, fileName);

    // 2. Compress image using sharp
    // Note: Use .toFormat('jpeg') or similar to ensure compatibility
    await sharp(filePath)
      .resize({ width: 1920, withoutEnlargement: true }) // Don't upscale small images
      .jpeg({ quality: 80 })
      .toFile(compressedPath);

    // 3. Upload to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(compressedPath, {
      resource_type: 'auto',
      folder: 'uploads', // Good practice to organize files
    });

    console.log("done")
    return uploadResponse;
  } catch (error) {
    console.error('Error in Cloudinary upload:', error);
    throw error;
  } finally {
    // 4. Always clean up temporary files (both compressed and original if needed)
    if (compressedPath) {
      await fs.unlink(compressedPath).catch(() => null); 
    }
    // Optional: await fs.unlink(filePath).catch(() => null);
  }
};

// ----------- Delete media -----------
const deletemedia = async (publicId, resourceType = 'image') => {
  try {
    // Using resourceType as a parameter makes this reusable for videos/raw files
    const deleteResponse = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return deleteResponse;
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
};

module.exports = { Uploadmedia, deletemedia };