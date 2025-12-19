const express = require('express');
const XLSX = require('xlsx');
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

const STUDENTS_FILE = path.join(__dirname, '../students.xlsx');

// Helper function to read students from Excel
const readStudents = () => {
    try {
        if (!fs.existsSync(STUDENTS_FILE)) {
            console.log('Students file does not exist, creating empty array');
            return [];
        }
        
        const workbook = XLSX.readFile(STUDENTS_FILE);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet || Object.keys(worksheet).length === 0) {
            return [];
        }
        
        return XLSX.utils.sheet_to_json(worksheet);
    } catch (error) {
        console.error('Error reading students file:', error);
        return [];
    }
};

// Helper function to write students to Excel
const writeStudents = (students) => {
    try {
        console.log(`Writing ${students.length} students to Excel file...`);
        
        // Create a new workbook
        const workbook = XLSX.utils.book_new();
        
        // Convert students array to worksheet
        const worksheet = XLSX.utils.json_to_sheet(students);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        
        // Write to file
        XLSX.writeFile(workbook, STUDENTS_FILE);
        
        console.log('✅ Successfully saved students to Excel file');
        return true;
    } catch (error) {
        console.error('❌ Error writing students file:', error);
        return false;
    }
};

// Get all students
router.get('/', (req, res) => {
    try {
        const students = readStudents();
        console.log(`Retrieved ${students.length} students from Excel`);
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Error fetching students', error: error.message });
    }
});

// Add a new student
router.post('/', (req, res) => {
    try {
        console.log('Adding new student:', req.body);
        
        const student = req.body;
        
        // Validate required fields
        if (!student.name || !student.email || !student.phone) {
            return res.status(400).json({ 
                message: 'Name, email, and phone are required fields' 
            });
        }
        
        // Read existing students
        const students = readStudents();
        console.log(`Currently have ${students.length} students`);
        
        // Generate unique ID
        student.id = Date.now() + Math.floor(Math.random() * 1000);
        student.createdAt = new Date().toISOString();
        
        // Add the new student
        students.push(student);
        
        // Write back to Excel
        if (writeStudents(students)) {
            console.log(`✅ Student "${student.name}" added successfully. Total students: ${students.length}`);
            res.json({ 
                message: 'Student added successfully',
                student,
                totalStudents: students.length
            });
        } else {
            console.error('❌ Failed to save student to Excel');
            res.status(500).json({ message: 'Error saving student to database' });
        }
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'Error adding student', error: error.message });
    }
});

// Export students to Excel
router.get('/export', (req, res) => {
    try {
        const students = readStudents();
        
        if (students.length === 0) {
            return res.status(404).json({ message: 'No students found to export' });
        }
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(students);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        
        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Disposition', 'attachment; filename="students_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        console.log(`✅ Exported ${students.length} students to Excel file`);
    } catch (error) {
        console.error('Error exporting students:', error);
        res.status(500).json({ message: 'Error exporting students', error: error.message });
    }
});

// Delete a student
router.delete('/:id', (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        console.log(`Attempting to delete student with ID: ${studentId}`);
        
        let students = readStudents();
        const initialLength = students.length;
        
        // Filter out the student to delete
        students = students.filter(s => s.id !== studentId);
        
        if (students.length < initialLength) {
            if (writeStudents(students)) {
                console.log(`✅ Student with ID ${studentId} deleted successfully`);
                res.json({ 
                    message: 'Student deleted successfully',
                    totalStudents: students.length
                });
            } else {
                res.status(500).json({ message: 'Error saving changes to database' });
            }
        } else {
            console.log(`❌ Student with ID ${studentId} not found`);
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'Error deleting student', error: error.message });
    }
});

module.exports = router;