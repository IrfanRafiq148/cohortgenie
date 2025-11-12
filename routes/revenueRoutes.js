const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const User = require('../models/User');
const  OAuthClient  = require('intuit-oauth');

require('dotenv').config();


// router.get('/invoice', authMiddleware, quickbookController.Invoice);
// GET /api/net-revenue?year=2024
// GET /api/net-revenue?quarter=2&year=2025
// GET /api/net-revenue?month=5&year=2025
// GET /api/net-revenue?monthsBack=3


router.get('/financial-report', revenueController.getFinancialReportHandler);

module.exports = router;
