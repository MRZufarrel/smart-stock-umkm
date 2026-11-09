import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  createRestock,
  getRestockHistory,
} from '../controllers/restockController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getRestockHistory);
router.post('/', createRestock);

export default router;
