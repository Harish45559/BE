// seedTestData.js
const { sequelize, Employee, Attendance } = require('./models');

async function seed() {
  await sequelize.sync({ force: false });

  // ✅ Create a sample employee with all required fields
  const [employee] = await Employee.findOrCreate({
    where: { username: 'john.doe' },
    defaults: {
      first_name: 'John',
      last_name: 'Doe',
      username: 'john.doe',
      pin: '1234',
      dob: new Date('1990-01-01'),
      joining_date: new Date('2022-01-01'),
      brp: 'BRP1234567',
      address: '123 Baker Street, London',
      password: 'password123'
    }
  });

  // ✅ Create attendance for that employee
  await Attendance.create({
    employee_id: employee.id,
    clock_in: new Date(Date.now() - 4 * 3600000), // 4 hours ago
    clock_out: new Date(),
    break_minutes: 30,
    total_work_minutes: 210,
    total_work_hours: '3h 30m'
  });

  console.log('✅ Test employee and attendance seeded!');
  process.exit();
}

seed().catch(console.error);
