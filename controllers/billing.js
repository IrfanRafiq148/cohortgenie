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
      success_url: 'http://24.199.101.185/dashboard/billing?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://24.199.101.185/dashboard/billing',
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
      session: session.url
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
    var user = await User.findById(req.user.id).select('-password');
    var flag = user.accessToken_qb && user.refreshToken_qb ? true : false;
    user = await User.findById(req.user.id).select('-password -accessToken_qb -refreshToken_qb');
    const userData = {
    ...user._doc,  // for Mongoose user objects
    connection_flag: flag
    };
    return res.status(200).json({ user: userData });

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
      return_url: 'http://24.199.101.185/dashboard/billing',
    });

    return res.json({
      success: true,
      session: session.url
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.cancel_Subscription = async (req, res) => {
  console.log("manageSubscription called", req, res);
/*************  ✨ Windsurf Command ⭐  *************/
    try {
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: "irfan1481999@gmail.com",
            subject: 'Your Subscription Status',
            html: `
                <h1>Your Subscription Status</h1>
                <p>Hello ${member.name},</p>
                <p>Your current subscription status is: ${member.subscriptionStatus}</p>
                <p>Your subscription will expire on: ${new Date(member.expires_at).toLocaleString()}</p>
                <p>Your subscription amount is: ${member.subscription_Amount}</p>
            `
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send subscription status email');
    }
/*******  8d9d122c-6218-4d9a-af85-8c5cc75d378e  *******/  
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