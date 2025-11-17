const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const User = require('../models/User');
const  OAuthClient  = require('intuit-oauth');

require('dotenv').config();


// router.get('/invoice', authMiddleware, quickbookController.Invoice);
// http://localhost:5000/api/revenue/financial-report?type=month&year=2025&month=6
// http://localhost:5000/api/revenue/financial-report?type=quarter&year=2025&quarter=2
// http://localhost:5000/api/revenue/financial-report?type=year&year=2025

// http://localhost:5000/api/revenue/financial-report?type=year



router.get('/financial-report', revenueController.getFinancialReportHandler);

module.exports = router;
