const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Hardcoded admin credentials (for demo)
const ADMIN_CREDENTIALS = {
    email: 'admin@auralith.com',
    password: 'admin123'
};

// Login endpoint
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check credentials
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        // Create JWT token
        const token = jwt.sign(
            { email, role: 'admin' },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );
        
        return res.json({ 
            token,
            user: { email, role: 'admin' }
        });
    } else {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
});

module.exports = router;