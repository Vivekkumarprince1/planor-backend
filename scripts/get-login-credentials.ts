import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { User } from '../src/models/User';

async function getLoginCredentials() {
  await mongoose.connect(env.MONGO_URI);
  
  console.log('🔐 PLANOR APP - LOGIN CREDENTIALS FOR TESTING\n');
  console.log('=' .repeat(60));
  
  // Get admins
  const admins = await User.find({ role: 'admin' }).limit(5);
  console.log('\n👑 ADMIN ACCOUNTS:');
  console.log('-'.repeat(40));
  admins.forEach((admin, i) => {
    console.log(`${i + 1}. Email: ${admin.email}`);
    console.log(`   Password: password123`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: Admin`);
    console.log('');
  });
  
  // Get approved managers
  const managers = await User.find({ role: 'manager', approved: true }).limit(8);
  console.log('\n👨‍💼 APPROVED MANAGER ACCOUNTS:');
  console.log('-'.repeat(40));
  managers.forEach((manager, i) => {
    console.log(`${i + 1}. Email: ${manager.email}`);
    console.log(`   Password: password123`);
    console.log(`   Name: ${manager.name}`);
    console.log(`   Area: ${manager.area}`);
    console.log(`   Business: ${manager.businessName}`);
    console.log(`   Role: Manager (Approved)`);
    console.log('');
  });
  
  // Get some pending managers
  const pendingManagers = await User.find({ role: 'manager', approved: false }).limit(3);
  console.log('\n⏳ PENDING MANAGER ACCOUNTS:');
  console.log('-'.repeat(40));
  pendingManagers.forEach((manager, i) => {
    console.log(`${i + 1}. Email: ${manager.email}`);
    console.log(`   Password: password123`);
    console.log(`   Name: ${manager.name}`);
    console.log(`   Area: ${manager.area}`);
    console.log(`   Business: ${manager.businessName}`);
    console.log(`   Role: Manager (Pending Approval)`);
    console.log('');
  });
  
  // Get regular users
  const users = await User.find({ role: 'user' }).limit(8);
  console.log('\n👥 REGULAR USER ACCOUNTS:');
  console.log('-'.repeat(40));
  users.forEach((user, i) => {
    console.log(`${i + 1}. Email: ${user.email}`);
    console.log(`   Password: password123`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Area: ${user.area}`);
    console.log(`   Role: User`);
    console.log('');
  });

  console.log('\n' + '='.repeat(60));
  console.log('💡 QUICK TEST RECOMMENDATIONS:');
  console.log('='.repeat(60));
  console.log('\n🔹 Admin Testing:');
  console.log('   Use: admin@planor.com / password123');
  console.log('   Features: Manage users, approve managers, handle commissions');
  
  if (managers.length > 0) {
    console.log('\n🔹 Manager Testing:');
    console.log(`   Use: ${managers[0].email} / password123`);
    console.log('   Features: Manage services, handle orders, chat with customers');
  }
  
  if (users.length > 0) {
    console.log('\n🔹 Customer Testing:');
    console.log(`   Use: ${users[0].email} / password123`);
    console.log('   Features: Browse services, place orders, post requirements');
  }

  console.log('\n🚀 All passwords are: password123');
  console.log('📱 Ready to test on mobile app or admin panel!\n');
  
  await mongoose.disconnect();
}

getLoginCredentials().catch((error) => {
  console.error('Failed to get credentials:', error);
  process.exit(1);
});
