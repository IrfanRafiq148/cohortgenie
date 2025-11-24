const express = require('express');
const router = express.Router();
const quickbookController = require('../controllers/quickbookController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const User = require('../models/User');
const  OAuthClient  = require('intuit-oauth');

require('dotenv').config();

// Initialize Intuit OAuth Client
const oauthClient = new OAuthClient({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    environment: process.env.ENVIRONMENT, // 'sandbox' or 'production'
    redirectUri: process.env.REDIRECT_URI
});

// Step 1: Redirect user to QuickBooks authorization page
// /auth route
router.get('/auth', (req, res) => {
    const userId = req.query.user_id  // <-- logged-in user id

    const authUri = oauthClient.authorizeUri({
        scope: [
            OAuthClient.scopes.Accounting,
            OAuthClient.scopes.OpenId,
            OAuthClient.scopes.Email
        ],
        state: `user_${userId}`   // <-- pass user id here securely
    });

    res.redirect(authUri);
});


// Step 2: Callback endpoint after user authorizes
router.get('/callback', async (req, res) => {
    try {
        // Extract state from query (contains our userId)
        const state = req.query.state;  // e.g., "user_654abc12edf3"
        const userId = state.replace("user_", "");

        const token = await oauthClient.createToken(req.url);

        console.log("User:", userId);
        console.log("Access Token:", token.token.access_token);
        console.log("Refresh Token:", token.token.refresh_token);
        console.log("Expiry:", token.token.expires_in);

        // ✅ Save in DB
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }
        user.accessToken_qb = token.token.access_token;
        user.refreshToken_qb = token.token.refresh_token;
        user.realmId = token.token.realmId;
        user.accessToken_expires_at_qb = token.token.expires_in; // Date object
        user.refreshToken_expires_at_qb = token.token.x_refresh_token_expires_in; // Date object
        user.accessToken_created_at_qb =  Date.now();
        user.refreshToken_created_at_qb = Date.now();
        await user.save();
            // Redirect user to frontend page
        res.redirect('https://cohortgenie.vercel.app/integration?step=2&status=connected');
        res.send(`QuickBooks token saved for user ${userId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to generate token.");
    }
});


// Optional: Refresh token
router.get('/refresh', async (req, res) => {
    try {
        const userId = req.user.id  // <-- logged-in user id
        const user = await User.findById(userId);
        oauthClient.setToken({
            refresh_token: user.refreshToken_qb,
            x_refresh_token_expires_in: user.refreshToken_expires_at_qb,
        });
        const refreshed = await oauthClient.refresh();
        console.log('New Access Token:', refreshed);
        user.accessToken_qb = refreshed.token.access_token;
        user.refreshToken_qb = refreshed.token.refresh_token;
        user.accessToken_expires_at_qb = refreshed.token.expires_in; // Date object
        user.refreshToken_expires_at_qb = refreshed.token.x_refresh_token_expires_in; // Date object
        user.accessToken_created_at_qb =  Date.now();
        user.refreshToken_created_at_qb = Date.now();
        await user.save();
        res.send('Token refreshed! Check console.');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// router.get('/invoice', authMiddleware, quickbookController.Invoice);
router.get('/invoice', authMiddleware, quickbookController.Invoice);
router.get('/customer', authMiddleware, quickbookController.Customer);
router.get('/salesreceipt', authMiddleware, quickbookController.SalesReceipt);
router.get('/refundreceipt', authMiddleware, quickbookController.RefundReceipt);
router.get('/creditmemo', authMiddleware, quickbookController.CreditMemo);

module.exports = router;
