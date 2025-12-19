const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);

// Route for login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route for dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});



// Create necessary directories if they don't exist
const directories = ['receipts', 'public'];
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
});

// Check if students.xlsx exists, create if not
const studentsFile = path.join(__dirname, 'students.xlsx');
if (!fs.existsSync(studentsFile)) {
  console.log('📁 Creating students.xlsx file...');
  const XLSX = require('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, studentsFile);
  console.log('✅ Created students.xlsx file');
}

// Add this route before app.listen() in server.js

// Test PDF generation
app.get('/test-pdf', (req, res) => {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');
  
  // Create test directory
  const testDir = path.join(__dirname, 'test-receipts');
  if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, 'test-receipt.pdf');
  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream(filePath);
  
  doc.pipe(writeStream);
  doc.fontSize(25).text('Test PDF Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
  doc.text('This is a test PDF to verify PDF generation works.');
  doc.end();
  
  writeStream.on('finish', () => {
      res.json({
          success: true,
          message: 'Test PDF generated',
          filePath: filePath,
          downloadUrl: `/download-test-pdf`
      });
  });
});

// Download test PDF
app.get('/download-test-pdf', (req, res) => {
  const filePath = path.join(__dirname, 'test-receipts', 'test-receipt.pdf');
  if (fs.existsSync(filePath)) {
      res.download(filePath);
  } else {
      res.status(404).send('Test PDF not found');
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`📁 Students file: ${studentsFile}`);
  console.log(`📁 Receipts folder: ${path.join(__dirname, 'receipts')}`);
});