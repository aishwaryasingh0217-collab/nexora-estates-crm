const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../public/uploads/brochures');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Uploaded files are served straight from /uploads, so the name we save must never come from the
// browser as-is: strip folders, keep only safe characters, and always end in .pdf so the server
// can only ever hand the file back as a PDF (never as a web page).
const safeName = (original) => {
  const base = path.basename(String(original || ''), path.extname(String(original || '')));
  const clean = base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'brochure';
  return `brochure_${Date.now()}_${clean}.pdf`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, safeName(file.originalname))
});

// The browser's claimed type is only a first check; the file's own first bytes are checked after upload
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    const err = new Error('Only PDF files are allowed for project brochures');
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1
  }
});

const looksLikePdf = (filePath) => {
  try {
    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(5);
    fs.readSync(fd, head, 0, 5, 0);
    fs.closeSync(fd);
    return head.toString('latin1') === '%PDF-';
  } catch {
    return false;
  }
};

const uploadBrochure = (req, res, next) => {
  upload.single('brochure')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        err.statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The brochure must be 10 MB or smaller';
      }
      return next(err);
    }
    if (req.file && !looksLikePdf(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      const bad = new Error('That file is not a real PDF. Please upload the brochure as a PDF.');
      bad.statusCode = 400;
      return next(bad);
    }
    next();
  });
};

module.exports = { uploadBrochure, safeName };
