const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // role: { type: String, enum: ['admin','user'], default: 'user' },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    realmId: String,
    refreshToken_qb: String,
    accessToken_qb: String,
    refreshToken_expires_at_qb : String,
    accessToken_expires_at_qb : String,
    accessToken_created_at_qb: Date,
    refreshToken_created_at_qb: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
