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

const  OAuthClient  = require('intuit-oauth');

require('dotenv').config();

// Initialize Intuit OAuth Client
const oauthClient = new OAuthClient({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    environment: process.env.ENVIRONMENT, // 'sandbox' or 'production'
    redirectUri: process.env.REDIRECT_URI
});

exports.getValidAccessToken = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // If access token is still valid → return it
    if (user.accessToken_expires_at_qb) {
        const expireDate = new Date(user.updatedAt.getTime() + user.accessToken_expires_at_qb * 1000);

        if (new Date() < expireDate) {
            console.log("✅ Access token still valid.");
            return user.accessToken_qb;
        }
    }

    console.log("🔄 Access token expired, refreshing...");

        oauthClient.setToken({
            refresh_token: user.refreshToken_qb,
            x_refresh_token_expires_in: user.refreshToken_expires_at_qb,
        });

    try {
        const refreshed = await oauthClient.refresh();
        const newAccess = refreshed.token.access_token;
        const newRefresh = refreshed.token.refresh_token;

        user.accessToken_qb = newAccess;
        user.refreshToken_qb = newRefresh;

        // ✅ save expiry timestamps
        user.accessToken_expires_at_qb = refreshed.token.expires_in;;
        user.refreshToken_expires_at_qb = refreshed.token.x_refresh_token_expires_in;
        await user.save();

        console.log("✅ Token refreshed and saved to DB.");
        return newAccess;
    } catch (err) {
        console.error("❌ Token refresh failed:", err.message);
        throw new Error("QuickBooks Token expired, re-auth required");
    }
};

exports.Invoice = async (req, res) => {
    console.log("Reached Invoice controller");
    try {
        var value = req.query.value || "previous36months";
        const userId = "6911d5e52824b16e46fce852";  // logged-in user id
        const user = await User.findById(userId);
        const accessToken = await exports.getValidAccessToken(userId);
        const companyId = user.realmId;
        const date = await fetchQuickBooksData.get_date(value);

        const query = `select * from Invoice Where Metadata.CreateTime > '${date}'`;

        const data = await fetchQuickBooksData.fetchQuickBooksData(accessToken, companyId, query);
        const invoices = data?.QueryResponse?.Invoice;

        if (!invoices || invoices.length === 0) {
            return res.json({ message: "No Invoices found" });
        }

        // Map invoices
        const mappedInvoices = invoices.map(invoice => ({
            id: invoice.Id,
            txnDate: new Date(invoice.TxnDate),
            amount: invoice.TotalAmt,
            customerRef: invoice.CustomerRef?.value ?? null,
        }));

        // Prepare bulk operations
        const operations = mappedInvoices.map(inv => ({
            updateOne: {
                filter: { _id: inv.id },
                update: inv,
                upsert: true
            }
        }));

        const bulkResult = await Invoice.bulkWrite(operations);

        console.log(`✅ Synced ${mappedInvoices.length} invoices`);
        return res.json(bulkResult);

    } catch (err) {
        console.error(err);  // log the actual error
        res.status(500).json({ message: 'Failed to fetch invoices' });
    }
};

exports.Customer = async (req, res) => {
    console.log("Reached Customer controller");

    try {
        var value = req.query.value || "previous36months";
        const userId = "6911d5e52824b16e46fce852";  // logged-in user id
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Get valid QuickBooks access token
        const accessToken = await exports.getValidAccessToken(userId);
        const companyId = user.realmId;

        // Get date 36 months back
        const date = await fetchQuickBooksData.get_date(value);
        console.log("Date for Customer fetch:", date);
        // QuickBooks query for customers
        const query = `select * from Customer Where Metadata.CreateTime > '${date}'`;
        const data = await fetchQuickBooksData.fetchQuickBooksData(accessToken, companyId, query);
        const customers = data?.QueryResponse?.Customer;

        if (!customers || customers.length === 0) {
            return res.json({ message: "No Customers found" });
        }

        // Map customer objects
        const mappedCustomers = customers.map(cust => ({
            _id: cust.Id,
            displayName: cust.DisplayName,
            homeCurrency: cust.CurrencyRef?.value ?? null,
        }));

        // Prepare bulk operations for MongoDB
        const operations = mappedCustomers.map(cust => ({
            updateOne: {
                filter: { _id: cust._id },
                update: cust,
                upsert: true, // create new or update existing
            }
        }));

        // Execute bulk write
        const bulkResult = await Customer.bulkWrite(operations);

        console.log(`✅ Synced ${mappedCustomers.length} customers`);
        return res.json(bulkResult);

    } catch (err) {
        console.error(err);  // log actual error
        res.status(500).json({ message: 'Failed to fetch Customers' });
    }
};

exports.SalesReceipt = async (req, res) => {
    console.log("Reached SalesReceipt controller");

    try {
        var value = req.query.value || "previous36months";
        const userId = "6911d5e52824b16e46fce852";  // logged-in user id
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Get valid QuickBooks access token
        const accessToken = await exports.getValidAccessToken(userId);
        const companyId = user.realmId;

        // Get date 36 months back
        const date = await fetchQuickBooksData.get_date(value);

        // QuickBooks query for sales receipts
        const query = `select * from SalesReceipt Where Metadata.CreateTime > '${date}'`;
        const data = await fetchQuickBooksData.fetchQuickBooksData(accessToken, companyId, query);

        const salesReceipts = data?.QueryResponse?.SalesReceipt;

        if (!salesReceipts || salesReceipts.length === 0) {
            return res.json({ message: "No SalesReceipts found" });
        }

        // Map sales receipt objects
        const mappedReceipts = salesReceipts.map(receipt => ({
            _id: receipt.Id,
            txnDate: receipt.TxnDate,
            amount: receipt.TotalAmt,
            customerRef: receipt.CustomerRef?.value ?? null
        }));

        // Prepare bulk operations for MongoDB
        const operations = mappedReceipts.map(receipt => ({
            updateOne: {
                filter: { _id: receipt._id },
                update: receipt,
                upsert: true, // create new or update existing
            }
        }));

        // Execute bulk write
        const bulkResult = await SalesReceipt.bulkWrite(operations);

        console.log(`✅ Synced ${mappedReceipts.length} SalesReceipts`);
        return res.json(bulkResult);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch SalesReceipts' });
    }
};
exports.RefundReceipt = async (req, res) => {
    console.log("Reached RefundReceipt controller");

    try {
        var value = req.query.value || "previous36months";
        const userId = "6911d5e52824b16e46fce852";  // logged-in user id
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Get valid QuickBooks access token
        const accessToken = await exports.getValidAccessToken(userId);
        const companyId = user.realmId;

        // Get date 36 months back
        const date = await fetchQuickBooksData.get_date(value);

        // QuickBooks query for RefundReceipts
        const query = `select * from RefundReceipt Where Metadata.CreateTime > '${date}'`;
        const data = await fetchQuickBooksData.fetchQuickBooksData(accessToken, companyId, query);

        const refundReceipts = data?.QueryResponse?.RefundReceipt;

        if (!refundReceipts || refundReceipts.length === 0) {
            return res.json({ message: "No RefundReceipts found" });
        }

        // Map refund receipt objects
        const mappedReceipts = refundReceipts.map(receipt => ({
            _id: receipt.Id,
            txnDate: receipt.TxnDate,
            amount: receipt.TotalAmt,
            customerRef: receipt.CustomerRef?.value ?? null
        }));

        // Prepare bulk operations for MongoDB
        const operations = mappedReceipts.map(receipt => ({
            updateOne: {
                filter: { _id: receipt._id },
                update: receipt,
                upsert: true, // create new or update existing
            }
        }));

        // Execute bulk write
        const bulkResult = await RefundReceipt.bulkWrite(operations);

        console.log(`✅ Synced ${mappedReceipts.length} RefundReceipts`);
        return res.json(bulkResult);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch RefundReceipts' });
    }
};
exports.CreditMemo = async (req, res) => {
    console.log("Reached CreditMemo controller");

    try {
        var value = req.query.value || "previous36months";
        const userId = "6911d5e52824b16e46fce852";  // logged-in user id
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Get valid QuickBooks access token
        const accessToken = await exports.getValidAccessToken(userId);
        const companyId = user.realmId;

        // Get date 36 months back
        const date = await fetchQuickBooksData.get_date();

        // QuickBooks query for CreditMemo
        const query = `select * from CreditMemo Where Metadata.CreateTime > '${date}'`;
        const data = await fetchQuickBooksData.fetchQuickBooksData(accessToken, companyId, query);

        const creditMemos = data?.QueryResponse?.CreditMemo;

        if (!creditMemos || creditMemos.length === 0) {
            return res.json({ message: "No CreditMemos found" });
        }

        // Map multiple credit memo objects
        const mappedMemos = creditMemos.map(memo => ({
            _id: memo.Id,
            txnDate: memo.TxnDate,
            amount: memo.TotalAmt,
            customerRef: memo.CustomerRef?.value ?? null
        }));

        // Prepare bulk operations for MongoDB
        const operations = mappedMemos.map(memo => ({
            updateOne: {
                filter: { _id: memo._id },
                update: memo,
                upsert: true, // create new or update existing
            }
        }));

        // Execute bulk write
        const bulkResult = await CreditMemo.bulkWrite(operations);

        console.log(`✅ Synced ${mappedMemos.length} CreditMemos`);
        return res.json(bulkResult);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch CreditMemos' });
    }
};

