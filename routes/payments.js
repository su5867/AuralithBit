const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

router.use(verifyToken);

// Process payment and generate receipt
router.post('/', (req, res) => {
  const { studentId, amount, description, studentName, studentEmail } = req.body;
  
  // In a real app, integrate with payment gateway here
  // For now, assume payment is successful

  const receiptId = `REC${Date.now()}`;
  const receiptPath = path.join(__dirname, `../receipts/receipt_${receiptId}.pdf`);

  // Ensure receipts directory exists
  const receiptsDir = path.join(__dirname, '../receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  // Generate PDF receipt
  const doc = new PDFDocument({ margin: 50 });
  const writeStream = fs.createWriteStream(receiptPath);
  doc.pipe(writeStream);
  
  // Header
  doc.fontSize(25).fillColor('#333333').text('AURALITH BIT', { align: 'center' });
  doc.fontSize(16).fillColor('#666666').text('Payment Receipt', { align: 'center' });
  doc.moveDown(2);
  
  // Receipt Details
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Receipt ID: ${receiptId}`, { continued: true });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
  doc.moveDown();
  
  doc.text(`Student Name: ${studentName}`);
  doc.text(`Student ID: ${studentId}`);
  doc.text(`Student Email: ${studentEmail}`);
  doc.moveDown();
  
  // Payment Details
  doc.fontSize(14).fillColor('#333333').text('Payment Details:');
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Amount: $${parseFloat(amount).toFixed(2)}`);
  doc.text(`Description: ${description}`);
  doc.moveDown();
  
  // Footer
  doc.fontSize(10).fillColor('#888888').text('Thank you for your payment!', { align: 'center' });
  doc.text('Auralith Bit - Siddharthanagar', { align: 'center' });
  doc.text('Contact: +977-XXXXXXXXXX | Email: info@auralith.com', { align: 'center' });
  
  doc.end();

  writeStream.on('finish', () => {
    res.json({ 
      message: 'Payment processed successfully', 
      receiptId,
      receiptPath: `/api/payments/receipt/${receiptId}`,
      studentEmail 
    });
  });

  writeStream.on('error', (err) => {
    console.error('Error generating PDF:', err);
    res.status(500).json({ message: 'Error generating receipt' });
  });
});

// Download receipt
router.get('/receipt/:id', (req, res) => {
  const receiptId = req.params.id;
  const receiptPath = path.join(__dirname, `../receipts/receipt_${receiptId}.pdf`);
  
  if (fs.existsSync(receiptPath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${receiptId}.pdf"`);
    res.download(receiptPath);
  } else {
    res.status(404).json({ message: 'Receipt not found' });
  }
});

// Send receipt via email
router.post('/send-receipt', async (req, res) => {
  const { receiptId, studentEmail, studentName } = req.body;
  const receiptPath = path.join(__dirname, `../receipts/receipt_${receiptId}.pdf`);

  if (!fs.existsSync(receiptPath)) {
    return res.status(404).json({ message: 'Receipt not found' });
  }

  // Configure email transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });

  const mailOptions = {
    from: `"Auralith Bit" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
    to: studentEmail,
    subject: `Payment Receipt - ${receiptId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Receipt</h2>
        <p>Dear ${studentName || 'Student'},</p>
        <p>Thank you for your payment. Please find attached your payment receipt.</p>
        <p><strong>Receipt ID:</strong> ${receiptId}</p>
        <p>If you have any questions, please contact us.</p>
        <br>
        <p>Best regards,<br>Auralith Bit Team</p>
      </div>
    `,
    attachments: [
      {
        filename: `receipt_${receiptId}.pdf`,
        path: receiptPath,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Receipt sent successfully to ' + studentEmail });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending email', error: error.message });
  }
});

module.exports = router;