const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

// Load environment variables in THIS file
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create base multer instance
const storage = multer.memoryStorage();

// PROBLEM PHOTOS UPLOAD - keep as middleware function
const problemUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

// QR CODE UPLOAD - keep as middleware function
const qrUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for QR codes!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  }
});

// BUSINESS PHOTOS UPLOAD - keep as middleware function
const businessPhotosUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for business photos!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3
  }
});

// Cloudinary upload functions (keep your existing ones)
const uploadProblemPhotosToCloudinary = async (fileBuffers, requestId) => {
  try {
    console.log('📤 Uploading to Cloudinary...');
    
    const uploadPromises = fileBuffers.map((fileBuffer, index) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'roadside-assistance/problem-photos',
            public_id: `problem-${requestId}-${Date.now()}-${index}`,
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto' },
              { format: 'jpg' }
            ]
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('✅ Cloudinary upload successful:', result.secure_url);
              resolve(result);
            }
          }
        );
        uploadStream.end(fileBuffer);
      });
    });

    const results = await Promise.all(uploadPromises);
    return results.map(result => ({
      url: result.secure_url,
      publicId: result.public_id
    }));

  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

const uploadQRToCloudinary = async (fileBuffer, providerId) => {
  try {
    console.log('📤 Uploading QR code to Cloudinary...');
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'roadside-assistance/qr-codes',
          public_id: `qr-${providerId}-${Date.now()}`,
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
            { format: 'png' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary QR upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary QR upload successful:', result.secure_url);
            resolve(result);
          }
        }
      );
      uploadStream.end(fileBuffer);
    });

  } catch (error) {
    console.error('❌ Cloudinary QR upload failed:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

const uploadBusinessPhotosToCloudinary = async (fileBuffers, providerId) => {
  try {
    console.log('📤 Uploading business photos to Cloudinary...');
    
    const uploadPromises = fileBuffers.map((fileBuffer, index) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'roadside-assistance/business-photos',
            public_id: `business-${providerId}-${Date.now()}-${index}`,
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto' },
              { format: 'jpg' }
            ]
          },
          (error, result) => {
            if (error) {
              console.error('❌ Business photo upload error:', error);
              reject(error);
            } else {
              console.log('✅ Business photo upload successful:', result.secure_url);
              resolve(result);
            }
          }
        );
        uploadStream.end(fileBuffer);
      });
    });

    const results = await Promise.all(uploadPromises);
    return results.map(result => ({
      url: result.secure_url,
      publicId: result.public_id,
      caption: `Business photo ${Date.now()}`
    }));

  } catch (error) {
    console.error('❌ Business photos upload failed:', error);
    throw new Error(`Business photos upload failed: ${error.message}`);
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    console.log('🗑️ Deleting from Cloudinary:', publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('✅ Cloudinary deletion result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error deleting from Cloudinary:', error);
    throw error;
  }
};

// ERROR HANDLING
const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Please upload a smaller file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Please upload fewer files.'
      });
    }
  }

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next();
};

// EXPORTS - FIXED: Export the multer instances, not the configured middleware
module.exports = {
  problemUpload,  // This is the multer instance
  qrUpload,       // This is the multer instance  
  businessPhotosUpload, // This is the multer instance
  storage,
  uploadProblemPhotosToCloudinary,
  uploadQRToCloudinary,
  uploadBusinessPhotosToCloudinary,
  deleteFromCloudinary,
  handleUploadErrors
};