import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getSales,
  createSale,
  importSalesCsv,
} from '../controllers/salesController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const uploadCsv = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        code: 'FILE_TOO_LARGE',
        message: 'Ukuran file CSV maksimal 5 MB.',
      });
    }

    return res.status(400).json({
      status: 'error',
      code: 'INVALID_UPLOAD',
      message: 'Gagal memproses file CSV yang diunggah.',
    });
  });
};

router.use(authMiddleware);

router.get('/', getSales);
router.post('/', createSale);
router.post('/import-csv', uploadCsv, importSalesCsv);

export default router;
