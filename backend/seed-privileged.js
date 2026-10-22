/**
 * Safely creates/updates the two canonical demo privileged accounts only.
 * Unlike seed.js, this script DOES NOT touch complaints, comments, notifications,
 * or system locks. It demotes any other admin/staff accounts to student so only
 * the two canonical accounts retain privileged roles.
 *
 * Run manually from backend/ after deploying the authController.js change:
 *   node seed-privileged.js
 * Ensure MONGO_URI points to the intended database before running.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const accounts = [
  { name: 'Campus Administrator', email: 'admin@manipal.edu', password: 'admin123', role: 'admin' },
  { name: 'Campus Staff', email: 'staff@manipal.edu', password: 'staff123', role: 'staff' },
];

async function upsertAccount(account) {
  let user = await User.findOne({ email: account.email }).select('+password');
  if (!user) {
    user = new User(account);
  } else {
    user.name = account.name;
    user.role = account.role;
    user.password = account.password; // User model pre-save hook hashes this.
    user.studentId = null;
  }
  await user.save();
  console.log(`Configured ${account.role}: ${account.email}`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Refusing to run without an explicit database target.');
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  for (const account of accounts) await upsertAccount(account);

  // Demote any additional privileged users without deleting records or complaint history.
  const canonicalEmails = accounts.map((a) => a.email);
  const result = await User.updateMany(
    { role: { $in: ['admin', 'staff'] }, email: { $nin: canonicalEmails } },
    { $set: { role: 'student' } }
  );
  console.log(`Demoted ${result.modifiedCount ?? result.nModified ?? 0} additional admin/staff account(s) to student.`);
  console.log('Done. No complaint or related records were modified.');
}

main()
  .catch((error) => {
    console.error(`Privileged account setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
