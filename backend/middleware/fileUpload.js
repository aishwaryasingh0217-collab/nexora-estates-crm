/**
 * Private file uploads (project documents, customer KYC, test evidence screenshots).
 *
 * Files are stored outside the public folder, in storage/uploads/<area>/, and are only served by
 * GET /api/suite/files/:area/:name to signed-in users whose role may see that area. Each file's
 * first bytes are checked, so a renamed executable can't pose as a PDF or image.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ROOT = path.join(__dirname, '../../storage/uploads');
const AREAS = ['project-docs', 'customer-docs', 'test-evidence'];
const MAX_BYTES = 15 * 1024 * 1024;

const TYPES = {
  'application/pdf': { ext: 'pdf', magic: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  'image/png': { ext: 'png', magic: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', magic: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' }
};

function areaDir(area) {
  if (!AREAS.includes(area)) throw new Error(`Unknown upload area ${area}`);
  const dir = path.join(ROOT, area);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** multer middleware for one file field named "file" in `area`. Adds req.savedFile = { name, url, size, originalName, mime }. */
function uploadTo(area, { types = Object.keys(TYPES) } = {}) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try { cb(null, areaDir(area)); } catch (err) { cb(err); }
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${TYPES[file.mimetype].ext}`)
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!types.includes(file.mimetype)) {
        return cb(Object.assign(new Error(`Upload a ${types.map((t) => TYPES[t].ext.toUpperCase()).join(', ')} file.`), { statusCode: 400 }));
      }
      cb(null, true);
    }
  }).single('file');

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 15 MB.' : err.message;
        return res.status(err.statusCode || 400).json({ status: 'error', message });
      }
      if (!req.file) return res.status(400).json({ status: 'error', message: 'Choose a file to upload.' });
      try {
        const fd = fs.openSync(req.file.path, 'r');
        const head = Buffer.alloc(16);
        fs.readSync(fd, head, 0, 16, 0);
        fs.closeSync(fd);
        if (!TYPES[req.file.mimetype].magic(head)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ status: 'error', message: 'That file’s contents don’t match its type.' });
        }
      } catch (e) {
        return res.status(400).json({ status: 'error', message: 'Could not read the uploaded file.' });
      }
      req.savedFile = {
        name: req.file.filename,
        url: `/api/suite/files/${area}/${req.file.filename}`,
        size: req.file.size,
        originalName: String(req.file.originalname || '').replace(/[^\w.\- ()]/g, '_').slice(0, 200),
        mime: req.file.mimetype
      };
      next();
    });
  };
}

/** Absolute path of a stored file, or null if the name isn't a plain stored file name. */
function storedPath(area, name) {
  if (!AREAS.includes(area) || !/^\d+-[a-f0-9]{12}\.(pdf|png|jpg|webp)$/.test(String(name))) return null;
  const p = path.join(ROOT, area, name);
  return fs.existsSync(p) ? p : null;
}

function removeStored(url) {
  const m = /^\/api\/suite\/files\/([a-z-]+)\/([^/]+)$/.exec(String(url || ''));
  if (!m) return;
  const p = storedPath(m[1], m[2]);
  if (p) fs.unlink(p, () => {});
}

module.exports = { uploadTo, storedPath, removeStored, AREAS };
