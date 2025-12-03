// controller/billing.js

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

// GET billing plans
exports.getBillingPlans = async (req, res) => {
  try {
    const plans = await stripe.plans.list({ limit: 5 });

    return res.json({
      success: true,
      plans: plans
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST /add-subscription
exports.addSubscription = async (req, res) => {
  try {
    const { plan } = req.body; // same as $request['plan']

    const session = await stripe.checkout.sessions.create({
      success_url: 'http://localhost:3000/updateprofile?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3000/billing',
      mode: 'subscription',
      line_items: [
        {
          price: plan, // Stripe price ID
          quantity: 1,
        }
      ]
    });

    return res.json({
      success: true,
      session: session
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateMember = async (req, res) => {
  try {
    // session id comes from frontend: request[0]
    const { sessionId } = req.body;

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    var status = session.status;
    if(session.status == 'complete' && session.amount_total == 0){
        status = 'trialing';
    }

    const subscription_data = await getSubscriptionDetails(session.subscription);
    const updateData = {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: status,
      expires_at: new Date(subscription_data.items.data[0].current_period_end * 1000), // convert timestamp → JS Date
      subscription_Amount: session.amount_total / 100 // convert cents to dollars
    };

    // Update user record in MongoDB
    await User.updateOne(
      { _id: req.user.id },  // same as Auth::id()
      updateData
    );

    return res.json({
      success: true,
      sub_id: session.customer
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.manageSubscription = async (req, res) => {
  try {
    const member = req.user; // same as Auth::user()

    // Create Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: member.stripeCustomerId,
      return_url: 'http://localhost:3000/dashboard',
    });

    return res.json({
      success: true,
      session
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

async function getSubscriptionDetails(subscriptionId) {
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return subscription;
    } catch (error) {
        console.error('Error fetching subscription:', error);
        throw error;
    }
}

// module.exports = { getSubscriptionDetails };