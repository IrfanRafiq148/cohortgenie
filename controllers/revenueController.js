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
        // Monthly range (month is 1-based)
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (year && quarter) {
        // Quarterly range (quarter is 1-4)
        const startMonth = (quarter - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
    } else if (year) {
        // Annual range
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
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return result[0]?.total || 0;
    } catch (err) {
        console.warn(`⚠️ Aggregation failed for ${Model.modelName}:`, err.message);
        return 0;
    }
};

/**
 * Helper: Count customers in the period
 */
const getCustomerCount = async (Customer, startDate, endDate) => {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const result = await Customer.aggregate([
            {
                $addFields: {
                    createdAtQB: { $toDate: "$createTime_at_qb" },
                },
            },
            {
                $match: {
                    createdAtQB: { $gte: start, $lte: end },
                },
            },
            {
                $group: { _id: "$_id" },
            },
            {
                $count: "count",
            },
        ]);

        return result[0]?.count || 0;
    } catch (err) {
        console.warn(`⚠️ Customer count failed:`, err.message);
        return 0;
    }
};

////////////////////////////////////////////////////////////////////////////////
// --- New / updated helpers for heatmaps ------------------------------------
////////////////////////////////////////////////////////////////////////////////

/**
 * Percentage matrix generator
 * arr: array of numeric totals, length = n
 * returns n x n matrix where matrix[i][j] = round((arr[j] / arr[i]) * 100)
 * If arr[i] === 0 -> matrix[i][j] = 0 (avoid div by zero)
 */
const percentageMatrix = (arr) => {
    const n = arr.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        const base = arr[i] || 0;
        for (let j = 0; j < n; j++) {
            const val = arr[j] || 0;
            matrix[i][j] = base === 0 ? 0 : Math.round((val / base) * 100);
        }
    }

    return matrix;
};

/**
 * Get monthly net revenue totals for a given year (returns array length 12)
 * uses aggregation for invoice + salesReceipt - creditMemo - refundReceipt
 */
const getMonthlyNetTotalsForYear = async (year, { Invoice, SalesReceipt, CreditMemo, RefundReceipt }) => {
    const monthlyTotals = Array(12).fill(0);

    // Helper to aggregate sums grouped by month
    const aggregateByMonth = async (Model) => {
        const res = await Model.aggregate([
            {
                $match: {
                    txnDate: {
                        $gte: new Date(year, 0, 1),
                        $lte: new Date(year, 11, 31, 23, 59, 59),
                    },
                },
            },
            {
                $project: {
                    month: { $month: "$txnDate" },
                    amount: "$amount",
                },
            },
            {
                $group: {
                    _id: "$month",
                    total: { $sum: "$amount" },
                },
            },
        ]);
        const map = {};
        res.forEach(r => { map[r._id] = r.total; });
        return map; // keys 1..12
    };

    const [invMap, srMap, cmMap, rrMap] = await Promise.all([
        aggregateByMonth(Invoice),
        aggregateByMonth(SalesReceipt),
        aggregateByMonth(CreditMemo),
        aggregateByMonth(RefundReceipt),
    ]);

    for (let m = 1; m <= 12; m++) {
        const inv = invMap[m] || 0;
        const sr = srMap[m] || 0;
        const cm = cmMap[m] || 0;
        const rr = rrMap[m] || 0;
        const net = inv + sr - (cm + rr);
        monthlyTotals[m - 1] = net;
    }

    return monthlyTotals;
};

/**
 * Get quarterly net totals for a given year (returns array length 4)
 */
const getQuarterlyNetTotalsForYear = async (year, models) => {
    const monthly = await getMonthlyNetTotalsForYear(year, models);
    const q = [
        monthly[0] + monthly[1] + monthly[2], // Q1
        monthly[3] + monthly[4] + monthly[5], // Q2
        monthly[6] + monthly[7] + monthly[8], // Q3
        monthly[9] + monthly[10] + monthly[11], // Q4
    ];
    return q;
};

/**
 * Get yearly net totals for ALL years present in DB for the four models.
 * Returns { years: [2022,2023,...], totals: [sum2022, sum2023, ...] }
 */
const getAllYearlyNetTotals = async ({ Invoice, SalesReceipt, CreditMemo, RefundReceipt }) => {
    // helper to aggregate totals by year per model
    const aggregateByYear = async (Model) => {
        const res = await Model.aggregate([
            {
                $project: {
                    year: { $year: "$txnDate" },
                    amount: "$amount",
                }
            },
            {
                $group: {
                    _id: "$year",
                    total: { $sum: "$amount" }
                }
            }
        ]);
        const map = {};
        res.forEach(r => { map[r._id] = r.total; });
        return map; // {year: total}
    };

    const [invMap, srMap, cmMap, rrMap] = await Promise.all([
        aggregateByYear(Invoice),
        aggregateByYear(SalesReceipt),
        aggregateByYear(CreditMemo),
        aggregateByYear(RefundReceipt),
    ]);

    // union of years
    const yearsSet = new Set([
        ...Object.keys(invMap).map(Number),
        ...Object.keys(srMap).map(Number),
        ...Object.keys(cmMap).map(Number),
        ...Object.keys(rrMap).map(Number),
    ]);

    const years = Array.from(yearsSet).sort((a, b) => a - b);
    const totals = years.map((y) => {
        const inv = invMap[y] || 0;
        const sr = srMap[y] || 0;
        const cm = cmMap[y] || 0;
        const rr = rrMap[y] || 0;
        return inv + sr - (cm + rr);
    });

    return { years, totals };
};

////////////////////////////////////////////////////////////////////////////////
// --- Existing financial summary & trend code (slightly adjusted) ----------
////////////////////////////////////////////////////////////////////////////////

/**
 * Helper: Calculate financial summary for given period
 */
const getFinancialSummary = async ({ month, quarter, year, type, models }) => {
    const { startDate, endDate } = getDateRange({ month, quarter, year });

    // === Current Period Totals ===
    const [
        invoiceTotal,
        salesReceiptTotal,
        creditMemoTotal,
        refundReceiptTotal,
        customerCount,
    ] = await Promise.all([
        getTotal(models.Invoice, startDate, endDate),
        getTotal(models.SalesReceipt, startDate, endDate),
        getTotal(models.CreditMemo, startDate, endDate),
        getTotal(models.RefundReceipt, startDate, endDate),
        getCustomerCount(models.Customer, startDate, endDate),
    ]);

    const totalRevenue = invoiceTotal + salesReceiptTotal;
    const totalRefunds = creditMemoTotal + refundReceiptTotal;
    const netRevenue = totalRevenue - totalRefunds;

    // === Baseline Revenue (Previous Month Only) ===
    const prevStart = new Date(startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);
    prevStart.setDate(1);

    const prevEnd = new Date(startDate);
    prevEnd.setDate(0);
    prevEnd.setHours(23, 59, 59, 999);

    const [prevInvoice, prevSales, prevCredit, prevRefund] = await Promise.all([
        getTotal(models.Invoice, prevStart, prevEnd),
        getTotal(models.SalesReceipt, prevStart, prevEnd),
        getTotal(models.CreditMemo, prevStart, prevEnd),
        getTotal(models.RefundReceipt, prevStart, prevEnd),
    ]);

    const prevNet = prevInvoice + prevSales - (prevCredit + prevRefund);
    const baselineRevenue = prevNet; // previous month’s net revenue only

    // === Expansion / Contraction / Churn ===
    const expansion = netRevenue > baselineRevenue ? netRevenue - baselineRevenue : 0;
    const contraction = netRevenue < baselineRevenue && netRevenue > 0 ? baselineRevenue - netRevenue : 0;
    const churn = netRevenue === 0 ? baselineRevenue : 0;

    // === GDR & NDR ===
    const GDR = baselineRevenue > 0 ? ((netRevenue / baselineRevenue) * 100).toFixed(2) : "0.00";
    const NDR =
        baselineRevenue > 0
            ? (((baselineRevenue + expansion - contraction - churn) / baselineRevenue) * 100).toFixed(2)
            : "0.00";

    // === Average LTV (per customer) ===
    const avgMonthlyRevenue = netRevenue / (customerCount || 1);
    const LTV = Number.isFinite(avgMonthlyRevenue) ? avgMonthlyRevenue.toFixed(2) : "0.00";

    // === Cohort Label ===
    let cohortLabel = "";
    if (type === "month") {
        const monthName = new Date(year, month - 1).toLocaleString("default", { month: "short" });
        cohortLabel = `${monthName} ${year.toString().slice(-2)}`;
    } else if (type === "quarter") {
        cohortLabel = `${year}-Q${quarter}`;
    } else {
        cohortLabel = `${year}`;
    }

    return {
        cohort: cohortLabel,
        customers: customerCount,
        metrics: {
            baselineRevenue: `$${Number(baselineRevenue || 0).toFixed(2)}`,
            totalRevenue: Number(totalRevenue || 0),
            totalRefunds: Number(totalRefunds || 0),
            netRevenue: Number(netRevenue || 0),
            expansion: Number(expansion || 0),
            contraction: Number(contraction || 0),
            churn: Number(churn || 0),
            GDR: `${GDR}%`,
            NDR: `${NDR}%`,
            LTV: `$${LTV}`,
        },
        period: { startDate, endDate },
    };
};

/**
 * Trend generator — month / quarter / year view
 * Returns { type, year, trend } where trend is array of { period, netRevenue }
 */
const getRevenueTrend = async (type, year, models) => {
    const trend = [];

    if (type === "month") {
        for (let m = 0; m < 12; m++) {
            const start = new Date(year, m, 1);
            const end = new Date(year, m + 1, 0, 23, 59, 59);

            const [invoiceTotal, salesReceiptTotal, creditMemoTotal, refundReceiptTotal] =
                await Promise.all([
                    getTotal(models.Invoice, start, end),
                    getTotal(models.SalesReceipt, start, end),
                    getTotal(models.CreditMemo, start, end),
                    getTotal(models.RefundReceipt, start, end),
                ]);

            const netRevenue = invoiceTotal + salesReceiptTotal - (creditMemoTotal + refundReceiptTotal);
            trend.push({ period: start.toLocaleString("default", { month: "short" }), netRevenue });
        }
    } else if (type === "quarter") {
        for (let q = 1; q <= 4; q++) {
            const startMonth = (q - 1) * 3;
            const start = new Date(year, startMonth, 1);
            const end = new Date(year, startMonth + 3, 0, 23, 59, 59);

            const [invoiceTotal, salesReceiptTotal, creditMemoTotal, refundReceiptTotal] =
                await Promise.all([
                    getTotal(models.Invoice, start, end),
                    getTotal(models.SalesReceipt, start, end),
                    getTotal(models.CreditMemo, start, end),
                    getTotal(models.RefundReceipt, start, end),
                ]);

            const netRevenue = invoiceTotal + salesReceiptTotal - (creditMemoTotal + refundReceiptTotal);
            trend.push({ period: `Q${q}`, netRevenue });
        }
    } else if (type === "year") {
        // Use complete historical data
        const { years, totals } = await getAllYearlyNetTotals(models);

        years.forEach((y, index) => {
            trend.push({
                period: y.toString(),
                netRevenue: totals[index],
            });
        });
    }

    return { type, year, trend };
};

////////////////////////////////////////////////////////////////////////////////
// --- Main Express Handler (updated to include heatmaps) ---------------------
////////////////////////////////////////////////////////////////////////////////

/**
 * Express Handler — CGP Financial Report (Dynamic Cohort View)
 */
exports.getFinancialReportHandler = async (req, res) => {
    try {
        const { type, month, quarter, year } = req.query;

       if (type !== "year" && !year) {
            return res.status(400).json({
                success: false,
                message: "Year is required for month or quarter type",
            });
        }


        if (!["month", "quarter", "year"].includes(type))
            return res.status(400).json({
                success: false,
                message: "Invalid type. Use 'month', 'quarter', or 'year'.",
            });

        // Provide your models here (adjust names if different in your code)
        const models = {
            Invoice: mongoose.model("Invoice"),
            SalesReceipt: mongoose.model("SalesReceipt"),
            CreditMemo: mongoose.model("CreditMemo"),
            RefundReceipt: mongoose.model("RefundReceipt"),
            Customer: mongoose.model("Customer"),
        };

        // Summary & trend (existing)
        const summary = await getFinancialSummary({
            type,
            month: type === "month" ? parseInt(month) : undefined,
            quarter: type === "quarter" ? parseInt(quarter) : undefined,
            year: parseInt(year),
            models,
        });

        const trend = await getRevenueTrend(type, parseInt(year), models);

        // -----------------------------
        // Heatmaps
        // -----------------------------
        // 1) Month totals for requested year (12)
        const monthTotals = await getMonthlyNetTotalsForYear(parseInt(year), models);
        const monthMatrix = percentageMatrix(monthTotals); // 12x12

        // 2) Quarter totals for requested year (4)
        const quarterTotals = await getQuarterlyNetTotalsForYear(parseInt(year), models);
        const quarterMatrix = percentageMatrix(quarterTotals); // 4x4

        // 3) Year totals for ALL years
        const { years: allYears, totals: yearTotals } = await getAllYearlyNetTotals(models);
        const yearMatrix = percentageMatrix(yearTotals); // NxN

        // Compose cohortGenie payload
        res.status(200).json({
            success: true,
            cohortGenie: {
                title: "CGP Financial Performance Dashboard",
                description: "Cohort-based Financial Summary and Trend Analysis",
                viewType: type,
                summary,
                trend,
                heatmap: {
                    month: {
                        year: parseInt(year),
                        monthTotals,   // raw numeric totals for each month (Jan..Dec)
                        monthMatrix,   // 12x12 percent matrix (rows = base month)
                        monthLabels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                    },
                    quarter: {
                        year: parseInt(year),
                        quarterTotals, // raw Q1..Q4 totals
                        quarterMatrix, // 4x4 percent matrix
                        quarterLabels: ["Q1","Q2","Q3","Q4"]
                    },
                    year: {
                        years: allYears,    // e.g. [2023,2024,2025]
                        yearTotals,         // raw totals matching years order
                        yearMatrix          // NxN percent matrix (rows = base year)
                    }
                }
            }
        });
    } catch (error) {
        console.error("❌ CGP FinancialReportHandler Error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};