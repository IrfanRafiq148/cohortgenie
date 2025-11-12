const User = require('../models/User');
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const SalesReceipt = require("../models/SalesReceipt");
const RefundReceipt = require("../models/RefundReceipt");
const CreditMemo = require("../models/CreditMemo");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const emailService = require('../services/emailService'); 
const fetchQuickBooksData = require('../utils/quickBooks');


require('dotenv').config();




/**
 * Helper: Get start & end date
 */
const getDateRange = ({ month, quarter, year }) => {
    let startDate, endDate;

    if (year && month) {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (year && quarter) {
        const startMonth = (quarter - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
    } else if (year) {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
    } else {
        endDate = new Date();
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }

    return { startDate, endDate };
};

/**
 * Helper: Aggregate total from collection within date range
 */
const getTotal = async (Model, startDate, endDate) => {
    try {
        const result = await Model.aggregate([
            { $match: { txnDate: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        return result[0]?.total || 0;
    } catch (err) {
        console.warn(`⚠️ Aggregation failed for ${Model.modelName}:`, err.message);
        return 0;
    }
};

/**
 * CGP Financial Summary
 */
exports.getFinancialSummary = async ({ month, quarter, year }) => {
    const { startDate, endDate } = getDateRange({ month, quarter, year });

    const [invoiceTotal, salesReceiptTotal, creditMemoTotal, refundReceiptTotal] =
        await Promise.all([
            getTotal(Invoice, startDate, endDate),
            getTotal(SalesReceipt, startDate, endDate),
            getTotal(CreditMemo, startDate, endDate),
            getTotal(RefundReceipt, startDate, endDate),
        ]);

    const totalRevenue = invoiceTotal + salesReceiptTotal;
    const totalRefunds = creditMemoTotal + refundReceiptTotal;
    const netRevenue = totalRevenue - totalRefunds;
    const grossProfit = netRevenue;
    const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return {
        cohortPeriod: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
        },
        metrics: {
            totalRevenue,
            totalRefunds,
            netRevenue,
            grossProfit,
            profitMargin: Number(profitMargin.toFixed(2)),
        },
        lastUpdated: new Date().toISOString(),
        source: "QuickBooks",
    };
};

/**
 * CGP Trend Report — monthly trend for a specific year
 */
exports.getRevenueTrend = async (year) => {
    if (!year) throw new Error("Year parameter is required for trend report.");

    const trend = [];

    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

        const [invoiceTotal, salesReceiptTotal, creditMemoTotal, refundReceiptTotal] =
            await Promise.all([
                getTotal(Invoice, monthStart, monthEnd),
                getTotal(SalesReceipt, monthStart, monthEnd),
                getTotal(CreditMemo, monthStart, monthEnd),
                getTotal(RefundReceipt, monthStart, monthEnd),
            ]);

        const totalRevenue = invoiceTotal + salesReceiptTotal;
        const totalRefunds = creditMemoTotal + refundReceiptTotal;
        const netRevenue = totalRevenue - totalRefunds;

        trend.push({
            month: monthStart.toLocaleString("default", { month: "short" }),
            netRevenue,
        });
    }

    return {
        trendYear: year,
        trendData: trend,
        source: "QuickBooks",
    };
};

/**
 * Express Handler — Combined CGP Financial Report
 */
exports.getFinancialReportHandler = async (req, res) => {
    try {
        const { month, quarter, year } = req.query;

        if (!year) return res.status(400).json({ success: false, message: "Year is required for trend report" });

        const [summary, trend] = await Promise.all([
            exports.getFinancialSummary({
                month: month ? parseInt(month) : undefined,
                quarter: quarter ? parseInt(quarter) : undefined,
                year: parseInt(year),
            }),
            exports.getRevenueTrend(parseInt(year)),
        ]);

        res.status(200).json({
            success: true,
            cohortGenie: {
                title: "CGP Financial Performance Dashboard",
                description: "Cohort-based Financial Summary and Revenue Trend",
                data: { summary, trend },
            },
        });
    } catch (error) {
        console.error("❌ CGP FinancialReportHandler Error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
