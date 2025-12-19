const express = require('express');
const XLSX = require('xlsx');
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

const STUDENTS_FILE = path.join(__dirname, '../students.xlsx');

// Helper function to read students from Excel
const readStudents = () => {
    try {
        if (!fs.existsSync(STUDENTS_FILE)) {
            console.log('Students file does not exist, returning empty array');
            return [];
        }
        
        const workbook = XLSX.readFile(STUDENTS_FILE);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Check if worksheet is empty
        if (!worksheet || Object.keys(worksheet).length <= 1) {
            return [];
        }
        
        const students = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Read ${students.length} students from Excel`);
        return students;
    } catch (error) {
        console.error('Error reading students file:', error);
        return [];
    }
};

// Helper function to write students to Excel
const writeStudents = (students) => {
    try {
        console.log(`Writing ${students.length} students to Excel...`);
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(students);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        
        // Write to file
        XLSX.writeFile(workbook, STUDENTS_FILE);
        
        console.log('✅ Successfully saved students to Excel');
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
        res.json({
            success: true,
            count: students.length,
            students: students
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching students',
            error: error.message 
        });
    }
});

// Add a new student
router.post('/', (req, res) => {
    try {
        console.log('Adding new student:', req.body);
        
        const studentData = req.body;
        
        // Validate required fields
        const requiredFields = ['name', 'phone', 'email', 'totalFee', 'amountPaid'];
        const missingFields = requiredFields.filter(field => !studentData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }
        
        // Read existing students
        const students = readStudents();
        
        // Generate unique ID and timestamp
        const newStudent = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            ...studentData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active'
        };
        
        // Calculate remaining balance if not provided
        if (!newStudent.remainingBalance) {
            const totalFee = parseFloat(newStudent.totalFee) || 0;
            const discount = parseFloat(newStudent.discount) || 0;
            const amountPaid = parseFloat(newStudent.amountPaid) || 0;
            const calculatedBalance = (totalFee - discount - amountPaid);
            newStudent.remainingBalance = calculatedBalance > 0 ? calculatedBalance.toFixed(2) : '0.00';
        }
        
        // Add the new student
        students.push(newStudent);
        
        // Write back to Excel
        if (writeStudents(students)) {
            console.log(`✅ Student "${newStudent.name}" added successfully. Total students: ${students.length}`);
            res.json({ 
                success: true,
                message: 'Student added successfully',
                student: newStudent,
                totalStudents: students.length
            });
        } else {
            throw new Error('Failed to save to Excel file');
        }
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error adding student',
            error: error.message 
        });
    }
});

// Update a student
router.put('/:id', (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const updatedData = req.body;
        
        console.log(`Updating student ID: ${studentId}`, updatedData);
        
        let students = readStudents();
        const studentIndex = students.findIndex(s => s.id === studentId);
        
        if (studentIndex === -1) {
            return res.status(404).json({ 
                success: false,
                message: 'Student not found' 
            });
        }
        
        // Update student data
        students[studentIndex] = {
            ...students[studentIndex],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        // Write back to Excel
        if (writeStudents(students)) {
            res.json({
                success: true,
                message: 'Student updated successfully',
                student: students[studentIndex]
            });
        } else {
            throw new Error('Failed to save updates');
        }
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating student',
            error: error.message 
        });
    }
});

// Delete a student
router.delete('/:id', (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        console.log(`Deleting student ID: ${studentId}`);
        
        let students = readStudents();
        const initialLength = students.length;
        
        // Filter out the student to delete
        students = students.filter(s => s.id !== studentId);
        
        if (students.length < initialLength) {
            if (writeStudents(students)) {
                console.log(`✅ Student with ID ${studentId} deleted successfully`);
                res.json({ 
                    success: true,
                    message: 'Student deleted successfully',
                    totalStudents: students.length
                });
            } else {
                throw new Error('Failed to save changes');
            }
        } else {
            res.status(404).json({ 
                success: false,
                message: 'Student not found' 
            });
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting student',
            error: error.message 
        });
    }
});

// Export students to Excel
router.get('/export/excel', (req, res) => {
    try {
        const students = readStudents();
        
        if (students.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'No students found to export' 
            });
        }
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(students);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        
        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        const filename = `students_export_${new Date().toISOString().slice(0,10)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', excelBuffer.length);
        
        res.send(excelBuffer);
        
        console.log(`✅ Exported ${students.length} students to Excel`);
    } catch (error) {
        console.error('Error exporting students:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error exporting students',
            error: error.message 
        });
    }
});

// Export students to CSV
router.get('/export/csv', (req, res) => {
    try {
        const students = readStudents();
        
        if (students.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'No students found to export' 
            });
        }
        
        // Convert to CSV
        const worksheet = XLSX.utils.json_to_sheet(students);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        // Set headers for download
        const filename = `students_export_${new Date().toISOString().slice(0,10)}.csv`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/csv');
        
        res.send(csv);
        
        console.log(`✅ Exported ${students.length} students to CSV`);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error exporting CSV',
            error: error.message 
        });
    }
});

// Get student statistics
router.get('/stats', (req, res) => {
    try {
        const students = readStudents();
        
        let totalFees = 0;
        let totalPaid = 0;
        let totalBalance = 0;
        let courseCount = {};
        let batchTimeCount = {};
        
        students.forEach(student => {
            totalFees += parseFloat(student.totalFee) || 0;
            totalPaid += parseFloat(student.amountPaid) || 0;
            totalBalance += parseFloat(student.remainingBalance) || 0;
            
            const course = student.course || 'Not Specified';
            courseCount[course] = (courseCount[course] || 0) + 1;
            
            const batch = student.batchTime || 'Not Specified';
            batchTimeCount[batch] = (batchTimeCount[batch] || 0) + 1;
        });
        
        res.json({
            success: true,
            stats: {
                totalStudents: students.length,
                totalFees: totalFees.toFixed(2),
                totalPaid: totalPaid.toFixed(2),
                totalBalance: totalBalance.toFixed(2),
                courseDistribution: courseCount,
                batchDistribution: batchTimeCount,
                completionRate: students.length > 0 ? ((totalPaid / totalFees) * 100).toFixed(2) + '%' : '0%'
            }
        });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error getting statistics',
            error: error.message 
        });
    }
});

// Search students
router.get('/search', (req, res) => {
    try {
        const { query } = req.query;
        const students = readStudents();
        
        if (!query) {
            return res.json({
                success: true,
                count: students.length,
                students: students
            });
        }
        
        const searchTerm = query.toLowerCase();
        const filteredStudents = students.filter(student => 
            (student.name && student.name.toLowerCase().includes(searchTerm)) ||
            (student.email && student.email.toLowerCase().includes(searchTerm)) ||
            (student.phone && student.phone.includes(searchTerm)) ||
            (student.course && student.course.toLowerCase().includes(searchTerm))
        );
        
        res.json({
            success: true,
            count: filteredStudents.length,
            students: filteredStudents
        });
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error searching students',
            error: error.message 
        });
    }
});

module.exports = router;