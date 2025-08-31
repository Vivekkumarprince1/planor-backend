import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env';
import { Category, Subcategory } from '../src/models/Taxonomy';
import { User } from '../src/models/User';
import { Service } from '../src/models/Service';
import { seedEnhancedData } from './seedEnhancedData';

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  
  console.log('Seeding database...');
  
  // Clear existing data
  await Promise.all([
    Category.deleteMany({}),
    Subcategory.deleteMany({}),
    User.deleteMany({}),
    Service.deleteMany({}),
  ]);
  
  // Seed categories for event and decoration services
  const categories = await Category.create([
    { 
      name: 'Marriage Decoration', 
      slug: 'marriage-decoration', 
      description: 'Complete wedding decoration services for your special day',
      icon: '💒', 
      color: '#FF6B6B',
      hasSubcategories: true,
      isActive: true,
      order: 1 
    },
    { 
      name: 'Birthday Decoration', 
      slug: 'birthday-decoration', 
      description: 'Make your birthday celebrations memorable with beautiful decorations',
      icon: '🎂', 
      color: '#4ECDC4',
      hasSubcategories: true,
      isActive: true,
      order: 2 
    },
    { 
      name: 'Photography', 
      slug: 'photography', 
      description: 'Professional photography services for all occasions',
      icon: '�', 
      color: '#45B7D1',
      hasSubcategories: true,
      isActive: true,
      order: 3 
    },
    { 
      name: 'Custom Design', 
      slug: 'custom-design', 
      description: 'Bespoke decoration and design services tailored to your needs',
      icon: '🎨', 
      color: '#96CEB4',
      hasSubcategories: false,
      isActive: true,
      order: 4 
    },
  ]);
  
  // Seed subcategories
  const subcategoriesData = [
    // Marriage Decoration subcategories
    { categoryId: categories[0]._id, name: 'Sangeet', slug: 'sangeet', description: 'Vibrant and colorful decorations for sangeet ceremonies', icon: '🎵', order: 1 },
    { categoryId: categories[0]._id, name: 'Haldi', slug: 'haldi', description: 'Traditional yellow-themed decorations for haldi ceremony', icon: '🌻', order: 2 },
    { categoryId: categories[0]._id, name: 'Mehndi', slug: 'mehndi', description: 'Beautiful and elegant decorations for mehndi ceremony', icon: '🤲', order: 3 },
    { categoryId: categories[0]._id, name: 'Wedding Ceremony', slug: 'wedding-ceremony', description: 'Grand decorations for the main wedding ceremony', icon: '👰', order: 4 },
    { categoryId: categories[0]._id, name: 'Reception', slug: 'reception', description: 'Elegant decorations for wedding reception', icon: '🥂', order: 5 },
    
    // Birthday Decoration subcategories
    { categoryId: categories[1]._id, name: 'Kids Birthday', slug: 'kids-birthday', description: 'Fun and colorful decorations for children\'s birthdays', icon: '🧸', order: 1 },
    { categoryId: categories[1]._id, name: 'Adult Birthday', slug: 'adult-birthday', description: 'Sophisticated decorations for adult birthday parties', icon: '🎊', order: 2 },
    { categoryId: categories[1]._id, name: 'Milestone Birthday', slug: 'milestone-birthday', description: 'Special decorations for milestone birthdays (18th, 21st, 50th, etc.)', icon: '🎖️', order: 3 },
    
    // Photography subcategories
    { categoryId: categories[2]._id, name: 'Wedding Photography', slug: 'wedding-photography', description: 'Professional wedding photography services', icon: '💍', order: 1 },
    { categoryId: categories[2]._id, name: 'Portrait Photography', slug: 'portrait-photography', description: 'Professional portrait and headshot photography', icon: '🖼️', order: 2 },
    { categoryId: categories[2]._id, name: 'Event Photography', slug: 'event-photography', description: 'Coverage for corporate and social events', icon: '🎯', order: 3 },
    { categoryId: categories[2]._id, name: 'Product Photography', slug: 'product-photography', description: 'Professional product photography for businesses', icon: '📦', order: 4 },
  ];
  
  const subcategories = await Subcategory.create(subcategoriesData);
  
  // Create demo manager users
  const passwordHash = await bcrypt.hash('demo123', 10);
  
  const managers = await User.create([
    {
      role: 'manager',
      name: 'Rajesh Sharma',
      email: 'rajesh@example.com',
      passwordHash,
      area: 'Mumbai',
      phone: '+91 9876543210',
    },
    {
      role: 'manager',
      name: 'Priya Patel',
      email: 'priya@example.com',
      passwordHash,
      area: 'Delhi',
      phone: '+91 9876543211',
    },
    {
      role: 'manager',
      name: 'Amit Singh',
      email: 'amit@example.com',
      passwordHash,
      area: 'Bangalore',
      phone: '+91 9876543212',
    },
  ]);
  
  // Create demo admin
  await User.create({
    role: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash,
  });
  
  // Create demo services
  const sampleServices = [
    {
      managerId: managers[0]._id,
      categoryId: categories[0]._id,
      subcategoryId: subcategories.find(s => s.slug === 'wedding-ceremony')?._id,
      title: 'Grand Wedding Ceremony Decoration',
      slug: 'grand-wedding-ceremony-decoration',
      description: 'Complete wedding decoration package including mandap, stage, floral arrangements, lighting, and draping. We create magical moments for your special day.',
      shortDescription: 'Complete wedding decoration with mandap, stage, and floral arrangements',
      basePrice: 50000,
      priceTiers: [
        { label: 'small', price: 50000, description: 'Basic wedding decoration for 100 guests', capacity: 100 },
        { label: 'medium', price: 100000, description: 'Premium decoration for 200 guests', capacity: 200 },
        { label: 'large', price: 200000, description: 'Luxury decoration for 500+ guests', capacity: 500 },
      ],
      addOns: [
        { name: 'LED lighting', price: 15000, description: 'Professional LED lighting setup' },
        { name: 'Photo booth', price: 10000, description: 'Decorated photo booth area' },
        { name: 'Welcome arch', price: 8000, description: 'Grand floral welcome arch' },
      ],
      areaServed: ['Mumbai', 'Navi Mumbai', 'Thane'],
      maxCapacity: 1000,
      features: ['Mandap Decoration', 'Stage Setup', 'Floral Arrangements', 'Draping', 'Lighting'],
      tags: ['wedding', 'marriage', 'ceremony', 'traditional'],
      media: [],
      location: {
        address: '123 Wedding Street, Andheri',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053'
      },
      contactInfo: {
        phone: '+91 9876543210',
        email: 'rajesh@example.com',
        whatsapp: '+91 9876543210'
      },
      ratingAverage: 4.5,
      ratingCount: 12,
      reviewCount: 8,
      isActive: true,
      status: 'approved'
    },
    {
      managerId: managers[1]._id,
      categoryId: categories[1]._id,
      subcategoryId: subcategories.find(s => s.slug === 'kids-birthday')?._id,
      title: 'Magical Kids Birthday Party Decoration',
      slug: 'magical-kids-birthday-decoration',
      description: 'Transform your child\'s birthday into a magical experience with themed decorations, balloon arrangements, backdrop setup, and fun props.',
      shortDescription: 'Themed kids birthday decoration with balloons and props',
      basePrice: 8000,
      priceTiers: [
        { label: 'small', price: 8000, description: 'Basic theme decoration for 20 kids', capacity: 20 },
        { label: 'medium', price: 15000, description: 'Premium theme with games for 40 kids', capacity: 40 },
        { label: 'large', price: 25000, description: 'Luxury theme with entertainment for 60+ kids', capacity: 60 },
      ],
      addOns: [
        { name: 'Balloon arch', price: 2000, description: 'Colorful balloon entrance arch' },
        { name: 'Face painting', price: 1500, description: 'Professional face painting for kids' },
        { name: 'Magic show', price: 5000, description: '1-hour magic show entertainment' },
      ],
      areaServed: ['Delhi', 'Gurgaon', 'Noida'],
      maxCapacity: 100,
      features: ['Themed Decoration', 'Balloon Setup', 'Backdrop', 'Props', 'Table Setup'],
      tags: ['birthday', 'kids', 'party', 'themed', 'balloons'],
      media: [],
      location: {
        address: '456 Party Avenue, CP',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      },
      contactInfo: {
        phone: '+91 9876543211',
        email: 'priya@example.com',
        whatsapp: '+91 9876543211'
      },
      ratingAverage: 4.8,
      ratingCount: 25,
      reviewCount: 18,
      isActive: true,
      status: 'approved'
    },
    {
      managerId: managers[2]._id,
      categoryId: categories[2]._id,
      subcategoryId: subcategories.find(s => s.slug === 'wedding-photography')?._id,
      title: 'Professional Wedding Photography & Videography',
      slug: 'professional-wedding-photography',
      description: 'Capture your wedding memories with our professional photography and videography services. We provide candid shots, traditional poses, and cinematic videos.',
      shortDescription: 'Professional wedding photography with candid and traditional shots',
      basePrice: 25000,
      priceTiers: [
        { label: 'small', price: 25000, description: 'Photography only (300+ photos)', capacity: 150 },
        { label: 'medium', price: 45000, description: 'Photo + Video (highlight reel)', capacity: 300 },
        { label: 'large', price: 75000, description: 'Complete package with album', capacity: 500 },
      ],
      addOns: [
        { name: 'Drone shots', price: 10000, description: 'Aerial photography and videography' },
        { name: 'Pre-wedding shoot', price: 15000, description: '4-hour pre-wedding photo session' },
        { name: 'Photo album', price: 8000, description: 'Premium photo album (50 pages)' },
      ],
      areaServed: ['Bangalore', 'Mysore', 'Mangalore'],
      features: ['Candid Photography', 'Traditional Shots', 'Videography', 'Photo Editing', 'Online Gallery'],
      tags: ['wedding', 'photography', 'videography', 'candid', 'professional'],
      media: [],
      location: {
        address: '789 Studio Road, Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560034'
      },
      contactInfo: {
        phone: '+91 9876543212',
        email: 'amit@example.com',
        whatsapp: '+91 9876543212'
      },
      businessHours: {
        monday: { open: '09:00', close: '18:00', isOpen: true },
        tuesday: { open: '09:00', close: '18:00', isOpen: true },
        wednesday: { open: '09:00', close: '18:00', isOpen: true },
        thursday: { open: '09:00', close: '18:00', isOpen: true },
        friday: { open: '09:00', close: '18:00', isOpen: true },
        saturday: { open: '10:00', close: '16:00', isOpen: true },
        sunday: { open: '10:00', close: '16:00', isOpen: false },
      },
      portfolio: [
        {
          title: 'Arjun & Meera Wedding',
          description: 'Beautiful traditional wedding in Mysore Palace',
          images: ['portfolio1.jpg', 'portfolio2.jpg'],
          completedAt: new Date('2024-12-15')
        }
      ],
      ratingAverage: 4.9,
      ratingCount: 35,
      reviewCount: 28,
      isActive: true,
      status: 'approved'
    }
  ];
  
  await Service.create(sampleServices);
  
  console.log('Database seeded successfully!');
  console.log(`Created ${categories.length} categories`);
  console.log(`Created ${subcategories.length} subcategories`);
  console.log(`Created ${managers.length} manager users`);
  console.log(`Created ${sampleServices.length} services`);
  
  // Add enhanced data
  console.log('\n🌱 Adding enhanced service data...');
  await seedEnhancedData();
  
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
