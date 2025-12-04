// routes/subscription.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const stripe = require('../services/stripe');
const billingController = require("../controllers/billing");
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create-subscription', async (req, res) => {
  const { userId, planId, paymentMethodId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create Stripe customer if not exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
    }

    // Create subscription with 14-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
      trial_period_days: 14,
      expand: ['latest_invoice.payment_intent'],
    });

    user.stripeSubscriptionId = subscription.id;
    user.subscriptionStatus = subscription.status;
    user.trialEnd = new Date(subscription.trial_end * 1000);

    await user.save();

    res.json({
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      trialEnd: user.trialEnd,
      clientSecret: subscription.latest_invoice.payment_intent?.client_secret || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/billing/plans",authMiddleware, billingController.getBillingPlans);
router.post("/billing/update-member",authMiddleware, billingController.updateMember);
router.get("/billing/manage-subscription", authMiddleware, billingController.manageSubscription);

router.post("/billing/add-subscription", billingController.addSubscription);

router.post("/billing/cancel-subscription",express.raw({ type: "application/json" }),billingController.stripeWebhook);


module.exports = router;
