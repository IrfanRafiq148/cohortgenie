// routes/webhook.js
const express = require('express');
const router = express.Router();
const stripe = require('../services/stripe');
const User = require('../models/User');

router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case 'customer.subscription.updated':
      const user = await User.findOne({ stripeSubscriptionId: data.id });
      if (user) {
        user.subscriptionStatus = data.status;
        await user.save();
      }
      break;

    case 'customer.subscription.deleted':
      const deletedUser = await User.findOne({ stripeSubscriptionId: data.id });
      if (deletedUser) {
        deletedUser.subscriptionStatus = 'canceled';
        await deletedUser.save();
      }
      break;

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
