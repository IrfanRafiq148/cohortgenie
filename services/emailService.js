const nodemailer = require('nodemailer');

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// Send welcome email with credentials
exports.sendWelcomeEmail = async (email, name, password) => {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: 'Welcome to Our Platform - Your Account Credentials',
        html: `
            <h1>Welcome to Our Platform</h1>
            <p>Hello ${name},</p>
            <p>Your account has been created successfully. Here are your login credentials:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${password}</p>
            <p>For security reasons, please change your password after your first login.</p>
            <p>You can login at: ${process.env.FRONTEND_URL}/login</p>
            <p>If you didn't request this account, please contact our support team immediately.</p>
            <br>
            <p>Best regards,</p>
            <p>Your Platform Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send welcome email');
    }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, name, resetUrl) => {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <h1>Password Reset Request</h1>
            <p>Hello ${name},</p>
            <p>You have requested to reset your password. Click the link below to set a new password:</p>
            <p><a href="${resetUrl}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email or contact our support team if you're concerned.</p>
            <br>
            <p>Best regards,</p>
            <p>Your Platform Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send password reset email');
    }
};