import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Category, Subcategory } from '../src/models/Taxonomy';
import { User } from '../src/models/User';
import { Service } from '../src/models/Service';

async function verifySeed() {
  await mongoose.connect(env.MONGO_URI);
  
  console.log('🔍 Verifying seeded data...\n');
  
  // Check categories
  const categories = await Category.find({}).sort({ order: 1 });
  console.log('📂 Categories:');
  categories.forEach((cat, index) => {
    console.log(`  ${index + 1}. ${cat.name} (${cat.slug}) - ${cat.hasSubcategories ? 'Has subcategories' : 'No subcategories'}`);
  });
  
  // Check subcategories
  const subcategories = await Subcategory.find({}).populate('categoryId', 'name').sort({ order: 1 });
  console.log('\n📝 Subcategories:');
  subcategories.forEach((subcat, index) => {
    console.log(`  ${index + 1}. ${subcat.name} (${subcat.slug}) - Category: ${(subcat.categoryId as any)?.name || 'N/A'}`);
  });
  
  // Check users
  const users = await User.find({});
  console.log('\n👥 Users:');
  users.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
  });
  
  // Check services
  const services = await Service.find({})
    .populate('categoryId', 'name')
    .populate('subcategoryId', 'name')
    .populate('managerId', 'name email');
  console.log('\n🛠️ Services:');
  services.forEach((service, index) => {
    console.log(`  ${index + 1}. ${service.title}`);
    console.log(`     Category: ${(service.categoryId as any)?.name || 'N/A'}`);
    console.log(`     Subcategory: ${(service.subcategoryId as any)?.name || 'N/A'}`);
    console.log(`     Manager: ${(service.managerId as any)?.name || 'N/A'} (${(service.managerId as any)?.email || 'N/A'})`);
    console.log(`     Base Price: ₹${service.basePrice}`);
    console.log(`     Status: ${service.status}`);
    console.log(`     Active: ${service.isActive}`);
    console.log('');
  });
  
  console.log('📊 Summary:');
  console.log(`  Total Categories: ${categories.length}`);
  console.log(`  Total Subcategories: ${subcategories.length}`);
  console.log(`  Total Users: ${users.length}`);
  console.log(`  Total Services: ${services.length}`);
  
  await mongoose.disconnect();
}

verifySeed().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
