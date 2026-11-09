import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { getForecasting } from '../controllers/forecastingController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/:variant_id', getForecasting);

export default router;
