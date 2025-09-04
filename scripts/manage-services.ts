import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import readline from 'readline';
import { Service } from '../src/models/Service';
import { Category, Subcategory } from '../src/models/Taxonomy';
import { User } from '../src/models/User';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/planner';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function addService() {
  try {
    console.log('\n=== Add New Service ===\n');
    
    // Get managers
    const managers = await User.find({ role: 'manager' });
    console.log('Available Managers:');
    managers.forEach((manager, index) => {
      console.log(`${index + 1}. ${manager.name} (${manager.email})`);
    });
    
    const managerIndex = parseInt(await question('Select manager (number): ')) - 1;
    if (managerIndex < 0 || managerIndex >= managers.length) {
      throw new Error('Invalid manager selection');
    }
    const selectedManager = managers[managerIndex];
    
    // Get categories
    const categories = await Category.find({});
    console.log('\nAvailable Categories:');
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}`);
    });
    
    const categoryIndex = parseInt(await question('Select category (number): ')) - 1;
    if (categoryIndex < 0 || categoryIndex >= categories.length) {
      throw new Error('Invalid category selection');
    }
    const selectedCategory = categories[categoryIndex];
    
    // Get subcategories for selected category
    const subcategories = await Subcategory.find({ categoryId: selectedCategory._id });
    let selectedSubcategory = null;
    
    if (subcategories.length > 0) {
      console.log('\nAvailable Subcategories:');
      console.log('0. None (skip subcategory)');
      subcategories.forEach((subcategory, index) => {
        console.log(`${index + 1}. ${subcategory.name}`);
      });
      
      const subcategoryIndex = parseInt(await question('Select subcategory (number, 0 for none): '));
      if (subcategoryIndex > 0 && subcategoryIndex <= subcategories.length) {
        selectedSubcategory = subcategories[subcategoryIndex - 1];
      }
    }
    
    // Get service details
    const title = await question('Enter service title: ');
    const description = await question('Enter service description: ');
    const basePrice = parseFloat(await question('Enter base price: '));
    
    // Get service areas
    console.log('\nEnter service areas (one per line, press Enter on empty line to finish):');
    const areas: string[] = [];
    while (true) {
      const area = await question('Area: ');
      if (!area.trim()) break;
      areas.push(area.trim());
    }
    
    if (areas.length === 0) {
      throw new Error('At least one service area is required');
    }
    
    // Create service
    const serviceData = {
      managerId: selectedManager._id,
      categoryId: selectedCategory._id,
      subcategoryId: selectedSubcategory?._id,
      title,
      description,
      basePrice,
      areaServed: areas,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
      status: 'approved', // Auto-approve for demo
      isActive: true
    };
    
    const service = new Service(serviceData);
    await service.save();
    
    console.log('\n✅ Service created successfully!');
    console.log('Service ID:', service._id);
    console.log('Title:', service.title);
    console.log('Areas served:', service.areaServed.join(', '));
    
  } catch (error) {
    console.error('Error adding service:', error);
  }
}

async function listServices() {
  try {
    console.log('\n=== Current Services ===\n');
    
    const services = await Service.find({})
      .populate('managerId', 'name email')
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .sort({ createdAt: -1 });
    
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.title}`);
      console.log(`   Category: ${(service.categoryId as any)?.name}`);
      if (service.subcategoryId) {
        console.log(`   Subcategory: ${(service.subcategoryId as any)?.name}`);
      }
      console.log(`   Manager: ${(service.managerId as any)?.name}`);
      console.log(`   Price: ₹${service.basePrice}`);
      console.log(`   Areas: ${service.areaServed?.join(', ') || 'None'}`);
      console.log(`   Status: ${service.status}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error listing services:', error);
  }
}

async function main() {
  await connectDatabase();
  
  while (true) {
    console.log('\n=== Service Management CLI ===');
    console.log('1. Add new service');
    console.log('2. List services');
    console.log('3. Exit');
    
    const choice = await question('Select option (1-3): ');
    
    switch (choice) {
      case '1':
        await addService();
        break;
      case '2':
        await listServices();
        break;
      case '3':
        console.log('Goodbye!');
        rl.close();
        await mongoose.disconnect();
        process.exit(0);
      default:
        console.log('Invalid option, please try again.');
    }
  }
}

main().catch(console.error);
