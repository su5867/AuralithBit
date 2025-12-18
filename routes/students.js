const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
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
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Apply token verification to all routes
router.use(verifyToken);

const STUDENTS_FILE = path.join(__dirname, '../students.xlsx');

// Helper function to read students from Excel
const readStudents = () => {
    try {
        if (!require('fs').existsSync(STUDENTS_FILE)) {
            return [];
        }
        const workbook = XLSX.readFile(STUDENTS_FILE);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(worksheet);
    } catch (error) {
        console.error('Error reading students file:', error);
        return [];
    }
};

// Helper function to write students to Excel
const writeStudents = (students) => {
    try {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(students);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        XLSX.writeFile(workbook, STUDENTS_FILE);
        return true;
    } catch (error) {
        console.error('Error writing students file:', error);
        return false;
    }
};

// Get all students
router.get('/', (req, res) => {
    try {
        const students = readStudents();
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Error fetching students' });
    }
});

// Add a new student
router.post('/', (req, res) => {
    try {
        const student = req.body;
        
        // Validate required fields
        if (!student.name || !student.email || !student.phone) {
            return res.status(400).json({ 
                message: 'Name, email, and phone are required fields' 
            });
        }
        
        // Add ID and timestamp
        student.id = Date.now();
        student.createdAt = new Date().toISOString();
        
        const students = readStudents();
        students.push(student);
        
        if (writeStudents(students)) {
            res.json({ 
                message: 'Student added successfully',
                student 
            });
        } else {
            res.status(500).json({ message: 'Error saving student' });
        }
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'Error adding student' });
    }
});

// Delete a student
router.delete('/:id', (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        let students = readStudents();
        
        const initialLength = students.length;
        students = students.filter(s => s.id !== studentId);
        
        if (students.length < initialLength) {
            if (writeStudents(students)) {
                res.json({ message: 'Student deleted successfully' });
            } else {
                res.status(500).json({ message: 'Error saving changes' });
            }
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'Error deleting student' });
    }
});

module.exports = router;