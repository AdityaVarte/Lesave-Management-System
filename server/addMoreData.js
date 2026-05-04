require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

const extraEmployees = [
  { name: 'David Miller',   email: 'david@company.com',   department: 'Operations', role: 'admin',    total_leaves: 25, password: 'pass123' },
  { name: 'Lisa Wong',      email: 'lisa@company.com',    department: 'Engineering', role: 'employee', total_leaves: 22, password: 'pass123' },
  { name: 'Michael Chen',   email: 'michael@company.com', department: 'Finance',     role: 'employee', total_leaves: 20, password: 'pass123' },
  { name: 'Sarah Jones',    email: 'sarah@company.com',   department: 'HR',          role: 'employee', total_leaves: 18, password: 'pass123' },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    for (const data of extraEmployees) {
      const existing = await Employee.findOne({ email: data.email });
      if (!existing) {
        const emp = new Employee(data);
        await emp.save();
        console.log(`+ Added: ${data.name} (${data.role})`);
      } else {
        console.log(`- Skipping: ${data.name} (Already exists)`);
      }
    }

    console.log('🎉 Extra data addition complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

run();
