const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    // role: { type: String, enum: ['admin','user'], default: 'user' },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    realmId: String,
    refreshToken_qb: String,
    accessToken_qb: String,
    refreshToken_expires_at_qb : String,
    accessToken_expires_at_qb : String,
    accessToken_created_at_qb: Date,
    refreshToken_created_at_qb: Date,
    last_sync: Date,
    googleId: String,       // for google login
    avatar: String,
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    subscriptionStatus: { type: String, enum: ['trialing','active','canceled'], default: 'trialing' },
    expires_at: { type: Date },
    subscription_Amount: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
