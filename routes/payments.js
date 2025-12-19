const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Apply token verification to all routes
router.use(verifyToken);

// Create receipts directory if it doesn't exist
const receiptsDir = path.join(__dirname, '../receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
    console.log(`✅ Created receipts directory: ${receiptsDir}`);
}

// Process payment and generate receipt
router.post('/', (req, res) => {
    try {
        const { studentId, studentName, studentEmail, amount, description } = req.body;
        
        console.log('Processing payment:', { studentId, studentName, studentEmail, amount });
        
        // Validate required fields
        if (!studentId || !studentName || !studentEmail || !amount) {
            return res.status(400).json({ 
                success: false,
                message: 'Student ID, Name, Email, and Amount are required' 
            });
        }
        
        const receiptId = `REC${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const receiptFileName = `receipt_${receiptId}.pdf`;
        const receiptPath = path.join(receiptsDir, receiptFileName);
        
        // Generate PDF receipt
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const writeStream = fs.createWriteStream(receiptPath);
        
        doc.pipe(writeStream);
        
        // Header
        doc.fontSize(25).font('Helvetica-Bold').fillColor('#2c3e50').text('AURALITH BIT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica').fillColor('#7f8c8d').text('Payment Receipt', { align: 'center' });
        doc.moveDown(1);
        
        // Add a line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#3498db').lineWidth(2).stroke();
        doc.moveDown(1);
        
        // Receipt Details
        doc.fontSize(14).fillColor('#2c3e50');
        doc.font('Helvetica-Bold').text('Receipt ID: ', { continued: true });
        doc.font('Helvetica').text(receiptId);
        
        doc.font('Helvetica-Bold').text('Date: ', { continued: true });
        doc.font('Helvetica').text(new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }));
        doc.moveDown(1.5);
        
        // Student Information
        doc.font('Helvetica-Bold').text('STUDENT INFORMATION:', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').text(`Name: ${studentName}`);
        doc.text(`ID: ${studentId}`);
        doc.text(`Email: ${studentEmail}`);
        doc.moveDown(1.5);
        
        // Payment Details
        doc.font('Helvetica-Bold').text('PAYMENT DETAILS:', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').text(`Amount: $${parseFloat(amount).toFixed(2)}`);
        doc.text(`Description: ${description || 'Course Fee Payment'}`);
        doc.moveDown(2);
        
        // Payment successful stamp
        doc.rect(200, doc.y, 200, 80).stroke('#27ae60').lineWidth(3);
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#27ae60')
           .text('PAYMENT SUCCESSFUL', 210, doc.y + 25, { width: 180, align: 'center' });
        doc.fontSize(12).fillColor('#7f8c8d')
           .text('Amount Received', 210, doc.y + 55, { width: 180, align: 'center' });
        doc.moveDown(3);
        
        // Footer
        doc.fontSize(10).fillColor('#95a5a6')
           .text('Auralith Bit - Siddharthanagar', { align: 'center' });
        doc.text('Contact: +977-XXXXXXXXXX | Email: info@auralith.com', { align: 'center' });
        doc.text('This is an official payment receipt from Auralith Bit', { align: 'center' });
        doc.moveDown(1);
        doc.text('Thank you for your business!', { align: 'center' });
        
        doc.end();
        
        writeStream.on('finish', () => {
            console.log(`✅ Receipt generated: ${receiptPath}`);
            
            // Create a receipt record in a JSON file for tracking
            const receiptRecord = {
                receiptId,
                studentId,
                studentName,
                studentEmail,
                amount: parseFloat(amount),
                description: description || 'Course Fee Payment',
                date: new Date().toISOString(),
                filePath: receiptPath,
                fileName: receiptFileName
            };
            
            // Save receipt record
            const receiptsFile = path.join(receiptsDir, 'receipts.json');
            let receipts = [];
            if (fs.existsSync(receiptsFile)) {
                receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
            }
            receipts.push(receiptRecord);
            fs.writeFileSync(receiptsFile, JSON.stringify(receipts, null, 2));
            
            res.json({ 
                success: true,
                message: 'Payment processed successfully',
                receiptId: receiptId,
                receiptUrl: `/api/payments/download/${receiptId}`,
                receiptPath: receiptPath,
                studentName: studentName,
                studentEmail: studentEmail,
                amount: amount,
                timestamp: new Date().toISOString()
            });
        });
        
        writeStream.on('error', (err) => {
            console.error('❌ Error generating PDF:', err);
            res.status(500).json({ 
                success: false,
                message: 'Error generating receipt',
                error: err.message 
            });
        });
        
    } catch (error) {
        console.error('❌ Payment processing error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error processing payment',
            error: error.message 
        });
    }
});

// Serve receipt for download
router.get('/download/:receiptId', (req, res) => {
    try {
        const receiptId = req.params.receiptId;
        
        // Read receipts.json to find the file
        const receiptsFile = path.join(receiptsDir, 'receipts.json');
        if (!fs.existsSync(receiptsFile)) {
            return res.status(404).json({ 
                success: false,
                message: 'Receipt not found' 
            });
        }
        
        const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
        const receipt = receipts.find(r => r.receiptId === receiptId);
        
        if (!receipt) {
            return res.status(404).json({ 
                success: false,
                message: 'Receipt not found' 
            });
        }
        
        const filePath = receipt.filePath;
        
        if (fs.existsSync(filePath)) {
            // Set headers for download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
            
            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
            console.log(`✅ Serving receipt download: ${receipt.fileName}`);
        } else {
            console.log(`❌ Receipt file not found: ${filePath}`);
            res.status(404).json({ 
                success: false,
                message: 'Receipt file not found' 
            });
        }
    } catch (error) {
        console.error('❌ Error serving receipt:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error serving receipt',
            error: error.message 
        });
    }
});

// Direct file download (alternative method)
router.get('/receipt/:receiptId', (req, res) => {
    try {
        const receiptId = req.params.receiptId;
        
        // Look for the file in receipts directory
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => file.includes(receiptId) && file.endsWith('.pdf'));
        
        if (receiptFile) {
            const filePath = path.join(receiptsDir, receiptFile);
            
            // Set headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${receiptFile}"`);
            
            // Send the file
            res.sendFile(filePath);
            console.log(`✅ Direct receipt download: ${receiptFile}`);
        } else {
            // Try JSON method
            const receiptsFile = path.join(receiptsDir, 'receipts.json');
            if (fs.existsSync(receiptsFile)) {
                const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
                const receipt = receipts.find(r => r.receiptId === receiptId);
                
                if (receipt && fs.existsSync(receipt.filePath)) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
                    res.sendFile(receipt.filePath);
                    console.log(`✅ Receipt found via JSON: ${receipt.fileName}`);
                    return;
                }
            }
            
            console.log(`❌ Receipt ${receiptId} not found`);
            res.status(404).json({ 
                success: false,
                message: 'Receipt not found. Please generate a new receipt.' 
            });
        }
    } catch (error) {
        console.error('❌ Error in receipt download:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error downloading receipt',
            error: error.message 
        });
    }
});

// View receipt (open in browser)
router.get('/view/:receiptId', (req, res) => {
    try {
        const receiptId = req.params.receiptId;
        
        // Look for the file
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => file.includes(receiptId) && file.endsWith('.pdf'));
        
        if (receiptFile) {
            const filePath = path.join(receiptsDir, receiptFile);
            
            // Set headers for viewing in browser
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${receiptFile}"`);
            
            // Send the file
            res.sendFile(filePath);
            console.log(`✅ Viewing receipt: ${receiptFile}`);
        } else {
            res.status(404).json({ 
                success: false,
                message: 'Receipt not found' 
            });
        }
    } catch (error) {
        console.error('❌ Error viewing receipt:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error viewing receipt',
            error: error.message 
        });
    }
});

// Send receipt via email
router.post('/send-receipt', async (req, res) => {
    try {
        const { receiptId, studentEmail, studentName } = req.body;
        
        console.log(`Sending receipt ${receiptId} to ${studentEmail}`);
        
        if (!receiptId || !studentEmail) {
            return res.status(400).json({ 
                success: false,
                message: 'Receipt ID and student email are required' 
            });
        }
        
        // Find the receipt file
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => file.includes(receiptId) && file.endsWith('.pdf'));
        
        if (!receiptFile) {
            console.log(`❌ Receipt file not found for ID: ${receiptId}`);
            return res.status(404).json({ 
                success: false,
                message: 'Receipt file not found' 
            });
        }
        
        const receiptPath = path.join(receiptsDir, receiptFile);
        
        // For demo, simulate email sending
        console.log(`✅ Simulating email send to ${studentEmail}`);
        
        // Simulate email delay
        setTimeout(() => {
            res.json({
                success: true,
                message: `Receipt sent successfully to ${studentEmail}`,
                receiptId: receiptId,
                studentEmail: studentEmail,
                simulated: true
            });
        }, 1500);
        
        
        // UNCOMMENT AND CONFIGURE FOR REAL EMAIL
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"Auralith Bit" <${process.env.EMAIL_USER}>`,
            to: studentEmail,
            subject: `Payment Receipt - ${receiptId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Payment Receipt</h2>
                    <p>Dear ${studentName},</p>
                    <p>Thank you for your payment. Please find attached your payment receipt.</p>
                    <p><strong>Receipt ID:</strong> ${receiptId}</p>
                    <p>If you have any questions, please contact us.</p>
                    <br>
                    <p>Best regards,<br>Auralith Bit Team</p>
                </div>
            `,
            attachments: [
                {
                    filename: receiptFile,
                    path: receiptPath,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        
        res.json({
            success: true,
            message: `Receipt sent successfully to ${studentEmail}`,
            receiptId: receiptId,
            studentEmail: studentEmail
        });
        
        
    } catch (error) {
        console.error('❌ Error sending email:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error sending email',
            error: error.message 
        });
    }
});

// List all receipts
router.get('/list', (req, res) => {
    try {
        const files = fs.readdirSync(receiptsDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        const receipts = pdfFiles.map(file => {
            const filePath = path.join(receiptsDir, file);
            const stats = fs.statSync(filePath);
            return {
                fileName: file,
                filePath: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        });
        
        res.json({
            success: true,
            count: receipts.length,
            receipts: receipts
        });
    } catch (error) {
        console.error('❌ Error listing receipts:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error listing receipts',
            error: error.message 
        });
    }
});

module.exports = router;