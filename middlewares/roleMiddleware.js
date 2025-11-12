const roleMiddleware = (roles) => {
    return (req, res, next) => {
        const userRole = req.user.role; // from authMiddleware
        if (!roles.includes(userRole)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

module.exports = roleMiddleware;
