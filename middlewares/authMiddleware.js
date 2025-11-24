const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from DB
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'User not found' });

        req.user = user;

        // Check expiry based on creation date
        const creationDate = new Date(user.refreshToken_created_at_qb);

        // 8726400 seconds = 101 days + 1 day = 102 days
        const offsetSeconds = 8726400 - 86400;
        const expiryDate = new Date(creationDate.getTime() + offsetSeconds * 1000);

        const currentDate = new Date();

        if (currentDate <= expiryDate) {
            return res.status(403).json({ message: 'Quick Book Access Expired. Please login again', quickbook: false });
        }

        // Continue if valid
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authMiddleware;

// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const authMiddleware = async (req, res, next) => {
//     const token = req.headers.authorization?.split(' ')[1]; // Bearer token
//     if (!token) return res.status(401).json({ message: 'Unauthorized' });

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = await User.findById(decoded.id).select('-password');
//         const creationDate = new Date("2025-11-24T10:46:01.050Z");

//         // 8726400 seconds = 101 days
//         const offsetSeconds = 8726400 + 86400; // add 1 day = 102 days total
//         const expiryDate = new Date(creationDate.getTime() + offsetSeconds * 1000);

//         const currentDate = new Date();

//         if (currentDate >= expiryDate) {
//             console.log(false); // expired
//         } else {
//             console.log(true);  // still valid
//         }
//         next();
//     } catch (err) {
//         res.status(401).json({ message: 'Invalid token' });
//     }
// };

// module.exports = authMiddleware;
