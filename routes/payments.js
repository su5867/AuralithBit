const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: 'Access denied. No token provided.' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ 
            success: false,
            message: 'Invalid or expired token' 
        });
    }
};

// Apply token verification to all routes
router.use(verifyToken);

// Create receipts directory
const receiptsDir = path.join(__dirname, '../receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
    console.log(`✅ Created receipts directory: ${receiptsDir}`);
}

// Process payment and generate receipt
router.post('/', async (req, res) => {
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
        
        // Generate unique receipt ID
        const receiptId = `REC${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const receiptFileName = `receipt_${receiptId}.pdf`;
        const receiptPath = path.join(receiptsDir, receiptFileName);
        
        // Generate PDF receipt
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            info: {
                Title: `Payment Receipt - ${receiptId}`,
                Author: 'Auralith Bit',
                Subject: 'Payment Receipt',
                Keywords: 'payment, receipt, invoice, auralith',
                Creator: 'Auralith Student Management System',
                CreationDate: new Date()
            }
        });
        
        // Create write stream
        const writeStream = fs.createWriteStream(receiptPath);
        doc.pipe(writeStream);
        
        // ========== START PDF CONTENT ==========
        
        // Header with logo placeholder
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor('#2c3e50')
           .text('AURALITH BIT', { align: 'center' });
        
        doc.moveDown(0.3);
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#7f8c8d')
           .text('Siddharthanagar, Nepal', { align: 'center' });
        
        doc.moveDown(1);
        
        // Title
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#3498db')
           .text('PAYMENT RECEIPT', { align: 'center', underline: true });
        
        doc.moveDown(1.5);
        
        // Receipt Details in a table-like format
        const startX = 50;
        let currentY = doc.y;
        
        // Receipt ID and Date
        doc.font('Helvetica-Bold').fontSize(12).text('Receipt ID:', startX, currentY);
        doc.font('Helvetica').text(receiptId, startX + 100, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('Date:', startX, currentY);
        doc.font('Helvetica').text(new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }), startX + 100, currentY);
        
        currentY += 30;
        
        // Student Information
        doc.font('Helvetica-Bold').fontSize(14).text('STUDENT INFORMATION', startX, currentY);
        currentY += 20;
        
        doc.font('Helvetica-Bold').fontSize(12).text('Name:', startX, currentY);
        doc.font('Helvetica').text(studentName, startX + 100, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('ID:', startX, currentY);
        doc.font('Helvetica').text(studentId, startX + 100, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('Email:', startX, currentY);
        doc.font('Helvetica').text(studentEmail, startX + 100, currentY);
        
        currentY += 30;
        
        // Payment Details
        doc.font('Helvetica-Bold').fontSize(14).text('PAYMENT DETAILS', startX, currentY);
        currentY += 20;
        
        doc.font('Helvetica-Bold').fontSize(12).text('Amount:', startX, currentY);
        doc.font('Helvetica').text(`$${parseFloat(amount).toFixed(2)}`, startX + 100, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('Description:', startX, currentY);
        doc.font('Helvetica').text(description || 'Course Fee Payment', startX + 100, currentY);
        
        currentY += 40;
        
        // Payment Status Stamp
        const stampWidth = 200;
        const stampHeight = 60;
        const stampX = (doc.page.width - stampWidth) / 2;
        
        doc.roundedRect(stampX, currentY, stampWidth, stampHeight, 10)
           .fillAndStroke('#d4edda', '#28a745');
        
        doc.font('Helvetica-Bold')
           .fontSize(18)
           .fillColor('#155724')
           .text('PAYMENT SUCCESSFUL', stampX, currentY + 15, {
               width: stampWidth,
               align: 'center'
           });
        
        doc.font('Helvetica')
           .fontSize(12)
           .fillColor('#155724')
           .text('Amount Received', stampX, currentY + 40, {
               width: stampWidth,
               align: 'center'
           });
        
        currentY += stampHeight + 40;
        
        // Terms and Conditions
        doc.font('Helvetica-Oblique')
           .fontSize(10)
           .fillColor('#95a5a6')
           .text('Terms & Conditions:', { underline: true });
        
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#7f8c8d')
           .text('1. This is an official receipt from Auralith Bit.', { indent: 20 });
        doc.text('2. Please keep this receipt for your records.', { indent: 20 });
        doc.text('3. For any queries, contact: info@auralith.com', { indent: 20 });
        doc.text('4. Receipt ID must be quoted in all communications.', { indent: 20 });
        
        doc.moveDown(2);
        
        // Footer
        doc.fontSize(10)
           .fillColor('#95a5a6')
           .text('Thank you for choosing Auralith Bit!', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.text('📍 Siddharthanagar, Nepal | 📞 +977-XXXXXXXXXX | ✉️ info@auralith.com', { align: 'center' });
        doc.text('www.auralith.com', { align: 'center' });
        
        // ========== END PDF CONTENT ==========
        
        doc.end();
        
        // Wait for PDF to be generated
        writeStream.on('finish', () => {
            console.log(`✅ Receipt generated successfully: ${receiptPath}`);
            
            // Create receipt record
            const receiptRecord = {
                receiptId,
                studentId,
                studentName,
                studentEmail,
                amount: parseFloat(amount),
                description: description || 'Course Fee Payment',
                date: new Date().toISOString(),
                filePath: receiptPath,
                fileName: receiptFileName,
                generatedBy: req.user.email
            };
            
            // Save receipt record to JSON file
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
                receiptPath: `/api/payments/download/${receiptId}`,
                receiptUrl: `/api/payments/download/${receiptId}`,
                downloadUrl: `/api/payments/download/${receiptId}`,
                studentName: studentName,
                studentEmail: studentEmail,
                amount: amount,
                timestamp: new Date().toISOString(),
                fileName: receiptFileName
            });
        });
        
        writeStream.on('error', (err) => {
            console.error('❌ Error generating PDF:', err);
            res.status(500).json({
                success: false,
                message: 'Error generating receipt PDF',
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

// Download receipt - MAIN FIXED ENDPOINT
router.get('/download/:receiptId', (req, res) => {
    try {
        const receiptId = req.params.receiptId;
        console.log(`Download request for receipt: ${receiptId}`);
        
        // Method 1: Look for file directly
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => 
            file.includes(receiptId) && file.endsWith('.pdf')
        );
        
        if (receiptFile) {
            const filePath = path.join(receiptsDir, receiptFile);
            
            console.log(`✅ Found receipt file: ${receiptFile}`);
            
            // Set headers for download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${receiptFile}"`);
            res.setHeader('Content-Length', fs.statSync(filePath).size);
            
            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
            fileStream.on('error', (err) => {
                console.error('Stream error:', err);
                res.status(500).json({
                    success: false,
                    message: 'Error streaming file'
                });
            });
            
            return;
        }
        
        // Method 2: Check receipts.json
        const receiptsFile = path.join(receiptsDir, 'receipts.json');
        if (fs.existsSync(receiptsFile)) {
            const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
            const receipt = receipts.find(r => r.receiptId === receiptId);
            
            if (receipt && fs.existsSync(receipt.filePath)) {
                console.log(`✅ Found receipt via JSON: ${receipt.fileName}`);
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
                res.setHeader('Content-Length', fs.statSync(receipt.filePath).size);
                
                const fileStream = fs.createReadStream(receipt.filePath);
                fileStream.pipe(res);
                return;
            }
        }
        
        // If not found
        console.log(`❌ Receipt not found: ${receiptId}`);
        res.status(404).json({
            success: false,
            message: 'Receipt not found. It may have been deleted or never generated.'
        });
        
    } catch (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading receipt',
            error: error.message
        });
    }
});

// Alternative download endpoint
router.get('/receipt/:receiptId', (req, res) => {
    // Redirect to download endpoint
    res.redirect(`/api/payments/download/${req.params.receiptId}`);
});

// View receipt in browser (inline) - UPDATED FUNCTION
router.get('/view/:receiptId', (req, res) => {
    try {
        const receiptId = req.params.receiptId;
        console.log(`View request for receipt: ${receiptId}`);
        
        // Look for file directly
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => 
            file.includes(receiptId) && file.endsWith('.pdf')
        );
        
        if (receiptFile) {
            const filePath = path.join(receiptsDir, receiptFile);
            
            console.log(`✅ Found receipt for viewing: ${receiptFile}`);
            
            // Set headers for inline viewing (not download)
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${receiptFile}"`);
            
            // Send the file
            res.sendFile(filePath);
            return;
        }
        
        // If not found, check receipts.json
        const receiptsFile = path.join(receiptsDir, 'receipts.json');
        if (fs.existsSync(receiptsFile)) {
            const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
            const receipt = receipts.find(r => r.receiptId === receiptId);
            
            if (receipt && fs.existsSync(receipt.filePath)) {
                console.log(`✅ Found receipt via JSON for viewing: ${receipt.fileName}`);
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName}"`);
                res.sendFile(receipt.filePath);
                return;
            }
        }
        
        // If not found
        console.log(`❌ Receipt not found for viewing: ${receiptId}`);
        res.status(404).json({
            success: false,
            message: 'Receipt not found'
        });
        
    } catch (error) {
        console.error('❌ View error:', error);
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
        
        console.log(`Email request for receipt: ${receiptId} to ${studentEmail}`);
        
        if (!receiptId || !studentEmail) {
            return res.status(400).json({
                success: false,
                message: 'Receipt ID and student email are required'
            });
        }
        
        // Find receipt file
        const files = fs.readdirSync(receiptsDir);
        const receiptFile = files.find(file => 
            file.includes(receiptId) && file.endsWith('.pdf')
        );
        
        if (!receiptFile) {
            return res.status(404).json({
                success: false,
                message: 'Receipt file not found'
            });
        }
        
        const receiptPath = path.join(receiptsDir, receiptFile);
        
        // For demo purposes, simulate email sending
        console.log(`✅ Simulating email send to: ${studentEmail}`);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({
            success: true,
            message: `Receipt sent successfully to ${studentEmail}`,
            receiptId: receiptId,
            studentEmail: studentEmail,
            simulated: true, // Remove this when using real email
            note: 'Email simulation complete. Configure real email in .env for actual sending.'
        });
        
         
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Payment Receipt</h2>
                    <p>Dear ${studentName},</p>
                    <p>Thank you for your payment to Auralith Bit. Please find your payment receipt attached.</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Receipt ID:</strong> ${receiptId}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <p>If you have any questions about this receipt, please contact us at info@auralith.com.</p>
                    
                    <br>
                    <p>Best regards,</p>
                    <p><strong>Auralith Bit Team</strong><br>
                    Siddharthanagar, Nepal<br>
                    📞 +977-9867223722<br>
                    ✉️ auralithbit018@gmail.com</p>
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
        console.error('Email error:', error);
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
        const receiptsFile = path.join(receiptsDir, 'receipts.json');
        
        if (!fs.existsSync(receiptsFile)) {
            return res.json({
                success: true,
                count: 0,
                receipts: []
            });
        }
        
        const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
        
        res.json({
            success: true,
            count: receipts.length,
            receipts: receipts
        });
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing receipts'
        });
    }
});

// Get payment statistics
router.get('/stats', (req, res) => {
    try {
        const receiptsFile = path.join(receiptsDir, 'receipts.json');
        
        if (!fs.existsSync(receiptsFile)) {
            return res.json({
                success: true,
                stats: {
                    totalPayments: 0,
                    totalAmount: 0,
                    todayPayments: 0,
                    todayAmount: 0,
                    monthlyPayments: 0,
                    monthlyAmount: 0
                }
            });
        }
        
        const receipts = JSON.parse(fs.readFileSync(receiptsFile, 'utf8'));
        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = new Date().toISOString().slice(0, 7);
        
        let totalAmount = 0;
        let todayPayments = 0;
        let todayAmount = 0;
        let monthlyPayments = 0;
        let monthlyAmount = 0;
        
        receipts.forEach(receipt => {
            const amount = parseFloat(receipt.amount) || 0;
            const receiptDate = receipt.date.slice(0, 10);
            const receiptMonth = receipt.date.slice(0, 7);
            
            totalAmount += amount;
            
            if (receiptDate === today) {
                todayPayments++;
                todayAmount += amount;
            }
            
            if (receiptMonth === thisMonth) {
                monthlyPayments++;
                monthlyAmount += amount;
            }
        });
        
        res.json({
            success: true,
            stats: {
                totalPayments: receipts.length,
                totalAmount: totalAmount.toFixed(2),
                todayPayments: todayPayments,
                todayAmount: todayAmount.toFixed(2),
                monthlyPayments: monthlyPayments,
                monthlyAmount: monthlyAmount.toFixed(2),
                averagePayment: receipts.length > 0 ? (totalAmount / receipts.length).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting payment statistics'
        });
    }
});

module.exports = router;