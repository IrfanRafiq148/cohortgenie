const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const User = require('../models/User');
const mongoose = require('mongoose');
const  OAuthClient  = require('intuit-oauth');

require('dotenv').config();


// router.get('/invoice', authMiddleware, quickbookController.Invoice);
// http://localhost:5000/api/revenue/financial-report?type=month&year=2025&month=6
// http://localhost:5000/api/revenue/financial-report?type=quarter&year=2025&quarter=2
// http://localhost:5000/api/revenue/financial-report?type=year&year=2025

// http://localhost:5000/api/revenue/financial-report?type=year



router.get('/financial-report', authMiddleware, revenueController.getFinancialReportHandler);


// http://localhost:5000/api/revenue/compare-periods?period1=2025&period2=2027&type=year
// http://localhost:5000/api/revenue/compare-periods?period1=2-2025&period2=3-2025&type=quarter
// http://localhost:5000/api/revenue/compare-periods?period1=09-2025&period2=10-2027&type=month

// router.get("/compare-periods", authMiddleware, async (req, res) => {
//     try {
//         const { period1, period2, type } = req.query;

//         if (!period1 || !period2 || !type) {
//             return res.status(400).json({
//                 success: false,
//                 message: "period1, period2, and type (month|quarter|year) are required"
//             });
//         }

//         const models = {
//             Invoice: mongoose.model("Invoice"),
//             SalesReceipt: mongoose.model("SalesReceipt"),
//             CreditMemo: mongoose.model("CreditMemo"),
//             RefundReceipt: mongoose.model("RefundReceipt"),
//             Customer: mongoose.model("Customer"),
//         };

//         const p1 = revenueController.parsePeriod(period1, type);
//         const p2 = revenueController.parsePeriod(period2, type);

//         const metrics1 = await revenueController.calculateMetrics(p1.start, p1.end, models);
//         const metrics2 = await revenueController.calculateMetrics(p2.start, p2.end, models);

//         const comparison = {
//             period1,
//             period2,
//             type,
//             metrics: { period1: metrics1, period2: metrics2 },
//             difference: {
//                 GDR: (parseFloat(metrics2.GDR) - parseFloat(metrics1.GDR)).toFixed(2) + "%",
//                 NDR: (parseFloat(metrics2.NDR) - parseFloat(metrics1.NDR)).toFixed(2) + "%",
//                 churn: metrics2.churn - metrics1.churn,
//                 LTV: (parseFloat(metrics2.LTV.slice(1)) - parseFloat(metrics1.LTV.slice(1))).toFixed(2),
//                 customers: metrics2.customers - metrics1.customers,
//                 netRevenue: metrics2.netRevenue - metrics1.netRevenue
//             }
//         };

//         res.json({ success: true, comparison });

//     } catch (err) {
//         console.error("Compare Periods Error:", err);
//         res.status(500).json({ success: false, message: err.message });
//     }
// });
router.get("/compare-periods", authMiddleware, async (req, res) => {
    try {
        const { period1, period2, type } = req.query;

        if (!period1 || !period2 || !type) {
            return res.status(400).json({
                success: false,
                message: "period1, period2, and type (month|quarter|year) are required"
            });
        }

        const models = {
            Invoice: mongoose.model("Invoice"),
            SalesReceipt: mongoose.model("SalesReceipt"),
            CreditMemo: mongoose.model("CreditMemo"),
            RefundReceipt: mongoose.model("RefundReceipt"),
            Customer: mongoose.model("Customer"),
        };

        // Parse periods
        const p1 = revenueController.parsePeriod(period1, type);
        const p2 = revenueController.parsePeriod(period2, type);

        // Calculate metrics
        const metrics1 = await revenueController.calculateMetrics(p1.start, p1.end, models);
        const metrics2 = await revenueController.calculateMetrics(p2.start, p2.end, models);

        // Compute difference
        const comparison = {
            period1,
            period2,
            type,
            metrics: { period1: metrics1, period2: metrics2 },
            difference: {
                GDR: (parseFloat(metrics2.GDR) - parseFloat(metrics1.GDR)).toFixed(2) + "%",
                NDR: (parseFloat(metrics2.NDR) - parseFloat(metrics1.NDR)).toFixed(2) + "%",
                churn: metrics2.churn - metrics1.churn,
                LTV: (parseFloat(metrics2.LTV.slice(1)) - parseFloat(metrics1.LTV.slice(1))).toFixed(2),
                customers: metrics2.customers - metrics1.customers,
                netRevenue: metrics2.netRevenue - metrics1.netRevenue
            }
        };

        // --- Generate chartData2lines ---
        function getLabels(type) {
            if (type === "month") return Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
            if (type === "quarter") return Array.from({ length: 4 }, (_, i) => `Q${i + 1}`);
            if (type === "year") return ["Y"];
            return [];
        }

        function getIndex(period, type) {
            const [num] = period.split('-').map(Number);
            if (type === "month") return num - 1;
            if (type === "quarter") return num - 1;
            if (type === "year") return 0;
            return 0;
        }

        const labels = getLabels(type);
        const idx1 = getIndex(period1, type);
        const idx2 = getIndex(period2, type);

        const chartData2lines = labels.map((label, idx) => ({
            month: label,
            period1: idx === idx1 ? metrics1.netRevenue : 0,
            period2: idx === idx2 ? metrics2.netRevenue : 0
        }));

        // Return response
        res.json({ success: true, comparison, chartData2lines });

    } catch (err) {
        console.error("Compare Periods Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});



module.exports = router;
