const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In-memory admin credentials (for demo)
// In production, use a database with hashed passwords
const ADMIN_CREDENTIALS = {
    email: 'admin@auralith.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin'
};

// Login endpoint
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }
        
        // Check credentials
        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
            // Create JWT token
            const token = jwt.sign(
                { 
                    email: ADMIN_CREDENTIALS.email,
                    name: ADMIN_CREDENTIALS.name,
                    role: ADMIN_CREDENTIALS.role 
                },
                process.env.JWT_SECRET || 'fallback_secret_key',
                { expiresIn: '24h' }
            );
            
            return res.json({ 
                success: true,
                message: 'Login successful',
                token,
                user: {
                    email: ADMIN_CREDENTIALS.email,
                    name: ADMIN_CREDENTIALS.name,
                    role: ADMIN_CREDENTIALS.role
                }
            });
        } else {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error during login',
            error: error.message 
        });
    }
});

// Verify token endpoint
router.post('/verify', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'No token provided' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
        
        res.json({
            success: true,
            message: 'Token is valid',
            user: decoded
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: error.message
        });
    }
});

module.exports = router;