const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../models/User");

// Generate JWT token
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// -----------------------------
// Google Login (Step 1)
// -----------------------------
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// -----------------------------
// Google Callback (Step 2)
// -----------------------------
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),

  (req, res) => {
    const token = createToken(req.user);

    // redirect with JWT token
    // var flag = req.user.accessToken_qb && req.user.refreshToken_qb ? true : false;
    //     const userData = {
    //         ...req.user._doc,  // for Mongoose user objects
    //         connection_flag: flag
    //     };
        res.redirect('http://localhost:3000/login?token=' + token + '&status=connected');
    res.json({
      message: "Google login successful",
      user: userData,
      token,
    });
  }
);

module.exports = router;
