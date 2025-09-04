import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env';

// Import all models
import { User } from '../src/models/User';
import { Category, Subcategory } from '../src/models/Taxonomy';
import { Service } from '../src/models/Service';
import { OrderModel } from '../src/models/Order';
import { CartModel } from '../src/models/Cart';
import { Requirement, RequirementQuote, RequirementNotification } from '../src/models/Requirement';
import { ReviewModel, NotificationModel } from '../src/models/Review';
import { ChatModel, MessageModel } from '../src/models/Chat';
import { Commission } from '../src/models/Commission';

// Sample data arrays
const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 
  'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
  'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad'
];

const sampleNames = {
  male: ['Rajesh', 'Amit', 'Suresh', 'Vikram', 'Arjun', 'Kiran', 'Deepak', 'Sanjay', 'Manoj', 'Ravi'],
  female: ['Priya', 'Sunita', 'Kavya', 'Sneha', 'Pooja', 'Meera', 'Anita', 'Ritu', 'Geeta', 'Shanti']
};

const sampleLastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Agarwal', 'Jain', 'Shah', 'Verma', 'Mehta'];

const sampleBusinessNames = [
  'Elite Decorators', 'Royal Events', 'Dream Celebrations', 'Perfect Moments', 'Golden Touch Decorators',
  'Elegant Affairs', 'Celebration Experts', 'Majestic Events', 'Premium Planners', 'Classic Celebrations'
];

async function clearDatabase() {
  console.log('🧹 Clearing existing data...');
  
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Subcategory.deleteMany({}),
    Service.deleteMany({}),
    OrderModel.deleteMany({}),
    CartModel.deleteMany({}),
    Requirement.deleteMany({}),
    RequirementQuote.deleteMany({}),
    RequirementNotification.deleteMany({}),
    ReviewModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    Commission.deleteMany({}),
  ]);
  
  console.log('✅ Database cleared');
}

function generateRandomName() {
  const isMale = Math.random() > 0.5;
  const firstName = isMale 
    ? sampleNames.male[Math.floor(Math.random() * sampleNames.male.length)]
    : sampleNames.female[Math.floor(Math.random() * sampleNames.female.length)];
  const lastName = sampleLastNames[Math.floor(Math.random() * sampleLastNames.length)];
  return `${firstName} ${lastName}`;
}

function generatePhoneNumber() {
  return `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/\s+/g, '.');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${cleanName}${Math.floor(Math.random() * 999)}@${domain}`;
}

async function seedCategories() {
  console.log('📂 Seeding categories and subcategories...');
  
  const categoriesData = [
    {
      name: 'Wedding Planning',
      slug: 'wedding-planning',
      description: 'Complete wedding planning and decoration services',
      icon: '💒',
      color: '#FF6B6B',
      hasSubcategories: true,
      order: 1,
      metadata: {
        keywords: ['wedding', 'marriage', 'ceremony', 'celebration', 'bride', 'groom'],
        seoTitle: 'Wedding Planning Services - Plan Your Perfect Day',
        seoDescription: 'Professional wedding planning services for your special day'
      },
      features: ['Event Coordination', 'Vendor Management', 'Decoration', 'Timeline Management'],
      requiredFields: [
        { fieldName: 'experience', fieldType: 'number', isRequired: true },
        { fieldName: 'maxCapacity', fieldType: 'number', isRequired: true }
      ]
    },
    {
      name: 'Photography & Videography',
      slug: 'photography-videography',
      description: 'Professional photography and videography services',
      icon: '📸',
      color: '#4ECDC4',
      hasSubcategories: true,
      order: 2,
      metadata: {
        keywords: ['photography', 'videography', 'camera', 'photos', 'videos'],
        seoTitle: 'Professional Photography Services',
        seoDescription: 'Capture your precious moments with professional photographers'
      },
      features: ['High Resolution', 'Professional Equipment', 'Photo Editing', 'Online Gallery'],
      requiredFields: [
        { fieldName: 'equipment', fieldType: 'multiselect', isRequired: true },
        { fieldName: 'experience', fieldType: 'number', isRequired: true }
      ]
    },
    {
      name: 'Catering Services',
      slug: 'catering-services',
      description: 'Professional catering services for all occasions',
      icon: '🍽️',
      color: '#45B7D1',
      hasSubcategories: true,
      order: 3,
      metadata: {
        keywords: ['catering', 'food', 'menu', 'chef', 'cuisine'],
        seoTitle: 'Professional Catering Services',
        seoDescription: 'Delicious catering services for your events'
      },
      features: ['Custom Menus', 'Professional Chefs', 'Service Staff', 'Equipment Rental'],
      requiredFields: [
        { fieldName: 'cuisine', fieldType: 'multiselect', isRequired: true },
        { fieldName: 'maxCapacity', fieldType: 'number', isRequired: true }
      ]
    },
    {
      name: 'Entertainment',
      slug: 'entertainment',
      description: 'Entertainment services for events and celebrations',
      icon: '🎭',
      color: '#96CEB4',
      hasSubcategories: true,
      order: 4,
      metadata: {
        keywords: ['entertainment', 'music', 'dance', 'performance', 'artist'],
        seoTitle: 'Entertainment Services for Events',
        seoDescription: 'Professional entertainers for your special occasions'
      },
      features: ['Live Performance', 'Sound System', 'Lighting', 'Stage Setup']
    },
    {
      name: 'Decoration & Flowers',
      slug: 'decoration-flowers',
      description: 'Beautiful decorations and floral arrangements',
      icon: '🌺',
      color: '#FECA57',
      hasSubcategories: true,
      order: 5,
      metadata: {
        keywords: ['decoration', 'flowers', 'floral', 'arrangements', 'design'],
        seoTitle: 'Decoration & Floral Services',
        seoDescription: 'Beautiful decorations and floral arrangements for events'
      },
      features: ['Custom Designs', 'Fresh Flowers', 'Installation', 'Maintenance']
    },
    {
      name: 'Transportation',
      slug: 'transportation',
      description: 'Transportation services for events and guests',
      icon: '🚗',
      color: '#FF9FF3',
      hasSubcategories: true,
      order: 6,
      metadata: {
        keywords: ['transportation', 'cars', 'buses', 'vehicles', 'rental'],
        seoTitle: 'Event Transportation Services',
        seoDescription: 'Reliable transportation services for your events'
      },
      features: ['Professional Drivers', 'Clean Vehicles', 'On-time Service', 'GPS Tracking']
    }
  ];

  const categories = await Category.create(categoriesData);

  // Subcategories data
  const subcategoriesData = [
    // Wedding Planning subcategories
    { categoryId: categories[0]._id, name: 'Full Wedding Planning', slug: 'full-wedding-planning', description: 'Complete end-to-end wedding planning', icon: '💍', order: 1 },
    { categoryId: categories[0]._id, name: 'Wedding Decoration', slug: 'wedding-decoration', description: 'Wedding venue decoration services', icon: '🎀', order: 2 },
    { categoryId: categories[0]._id, name: 'Mehendi Ceremony', slug: 'mehendi-ceremony', description: 'Mehendi ceremony planning and decoration', icon: '🤲', order: 3 },
    { categoryId: categories[0]._id, name: 'Sangeet Planning', slug: 'sangeet-planning', description: 'Sangeet ceremony planning and coordination', icon: '🎵', order: 4 },
    { categoryId: categories[0]._id, name: 'Reception Planning', slug: 'reception-planning', description: 'Wedding reception planning and management', icon: '🥂', order: 5 },

    // Photography subcategories
    { categoryId: categories[1]._id, name: 'Wedding Photography', slug: 'wedding-photography', description: 'Professional wedding photography', icon: '👰', order: 1 },
    { categoryId: categories[1]._id, name: 'Pre-Wedding Shoot', slug: 'pre-wedding-shoot', description: 'Pre-wedding photography sessions', icon: '💑', order: 2 },
    { categoryId: categories[1]._id, name: 'Portrait Photography', slug: 'portrait-photography', description: 'Professional portrait photography', icon: '📷', order: 3 },
    { categoryId: categories[1]._id, name: 'Event Videography', slug: 'event-videography', description: 'Professional event videography', icon: '🎥', order: 4 },
    { categoryId: categories[1]._id, name: 'Drone Photography', slug: 'drone-photography', description: 'Aerial photography and videography', icon: '🚁', order: 5 },

    // Catering subcategories
    { categoryId: categories[2]._id, name: 'North Indian Cuisine', slug: 'north-indian-cuisine', description: 'North Indian catering services', icon: '🍛', order: 1 },
    { categoryId: categories[2]._id, name: 'South Indian Cuisine', slug: 'south-indian-cuisine', description: 'South Indian catering services', icon: '🥘', order: 2 },
    { categoryId: categories[2]._id, name: 'Chinese Cuisine', slug: 'chinese-cuisine', description: 'Chinese food catering', icon: '🥡', order: 3 },
    { categoryId: categories[2]._id, name: 'Continental Cuisine', slug: 'continental-cuisine', description: 'Continental food catering', icon: '🍽️', order: 4 },
    { categoryId: categories[2]._id, name: 'Live Counters', slug: 'live-counters', description: 'Live cooking counters for events', icon: '👨‍🍳', order: 5 },

    // Entertainment subcategories
    { categoryId: categories[3]._id, name: 'DJ Services', slug: 'dj-services', description: 'Professional DJ services', icon: '🎧', order: 1 },
    { categoryId: categories[3]._id, name: 'Live Band', slug: 'live-band', description: 'Live music bands for events', icon: '🎸', order: 2 },
    { categoryId: categories[3]._id, name: 'Dance Performers', slug: 'dance-performers', description: 'Professional dance performances', icon: '💃', order: 3 },
    { categoryId: categories[3]._id, name: 'Anchor/Host', slug: 'anchor-host', description: 'Event anchoring and hosting', icon: '🎤', order: 4 },
    { categoryId: categories[3]._id, name: 'Magic Show', slug: 'magic-show', description: 'Magic shows for entertainment', icon: '🎩', order: 5 },

    // Decoration subcategories
    { categoryId: categories[4]._id, name: 'Stage Decoration', slug: 'stage-decoration', description: 'Wedding and event stage decoration', icon: '🎪', order: 1 },
    { categoryId: categories[4]._id, name: 'Floral Arrangements', slug: 'floral-arrangements', description: 'Beautiful floral decorations', icon: '💐', order: 2 },
    { categoryId: categories[4]._id, name: 'Balloon Decoration', slug: 'balloon-decoration', description: 'Creative balloon decorations', icon: '🎈', order: 3 },
    { categoryId: categories[4]._id, name: 'Lighting Setup', slug: 'lighting-setup', description: 'Professional lighting arrangements', icon: '💡', order: 4 },
    { categoryId: categories[4]._id, name: 'Theme Decoration', slug: 'theme-decoration', description: 'Themed party decorations', icon: '🎨', order: 5 },

    // Transportation subcategories
    { categoryId: categories[5]._id, name: 'Luxury Cars', slug: 'luxury-cars', description: 'Luxury car rental for weddings', icon: '🚙', order: 1 },
    { categoryId: categories[5]._id, name: 'Guest Transportation', slug: 'guest-transportation', description: 'Bus services for guest transportation', icon: '🚌', order: 2 },
    { categoryId: categories[5]._id, name: 'Vintage Cars', slug: 'vintage-cars', description: 'Classic and vintage car rental', icon: '🚗', order: 3 },
    { categoryId: categories[5]._id, name: 'Horse Carriage', slug: 'horse-carriage', description: 'Traditional horse carriage for weddings', icon: '🐎', order: 4 }
  ];

  await Subcategory.create(subcategoriesData);
  
  console.log(`✅ Created ${categories.length} categories and ${subcategoriesData.length} subcategories`);
  return { categories, subcategories: subcategoriesData };
}

async function seedUsers() {
  console.log('👥 Seeding users...');
  
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // Create admin users
  const admins = await User.create([
    {
      role: 'admin',
      name: 'Super Admin',
      email: 'admin@planor.com',
      phone: '+91 9876543210',
      passwordHash,
      approved: true
    },
    {
      role: 'admin',
      name: 'Admin Manager',
      email: 'manager.admin@planor.com',
      phone: '+91 9876543211',
      passwordHash,
      approved: true
    }
  ]);

  // Create manager users with detailed profiles
  const managers = [];
  for (let i = 0; i < 25; i++) {
    const name = generateRandomName();
    const city = indianCities[Math.floor(Math.random() * indianCities.length)];
    const businessName = `${sampleBusinessNames[Math.floor(Math.random() * sampleBusinessNames.length)]} ${city}`;
    
    const manager = await User.create({
      role: 'manager',
      name,
      email: generateEmail(name),
      phone: generatePhoneNumber(),
      passwordHash,
      area: city,
      businessName,
      businessDescription: `Professional event planning and decoration services in ${city}. We specialize in creating memorable experiences for all occasions.`,
      aadharCard: {
        number: `${Math.floor(Math.random() * 999999999999)}`,
        imageUrl: 'https://via.placeholder.com/400x250/4ECDC4/FFFFFF?text=Aadhar+Card',
        verified: Math.random() > 0.3
      },
      bankDetails: {
        accountNumber: `${Math.floor(Math.random() * 9999999999999999)}`,
        ifscCode: `${['ICIC', 'HDFC', 'SBIN', 'AXIS'][Math.floor(Math.random() * 4)]}0001234`,
        bankName: ['ICICI Bank', 'HDFC Bank', 'State Bank of India', 'Axis Bank'][Math.floor(Math.random() * 4)],
        branchName: `${city} Main Branch`,
        accountHolderName: name,
        verified: Math.random() > 0.4
      },
      addresses: [{
        label: 'Business Address',
        line1: `${Math.floor(Math.random() * 999) + 1}, Business Complex`,
        line2: `${city} District`,
        city,
        state: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat'][Math.floor(Math.random() * 5)],
        pincode: `${Math.floor(Math.random() * 900000) + 100000}`,
        isDefault: true,
        geo: {
          lat: 12.9716 + (Math.random() - 0.5) * 10,
          lng: 77.5946 + (Math.random() - 0.5) * 10
        }
      }],
      ratingsAverage: 3.5 + Math.random() * 1.5
    });
    
    // Manually approve 80% of managers after creation to override the middleware
    if (Math.random() > 0.2) {
      await User.findByIdAndUpdate(manager._id, { 
        approved: true,
        approvedAt: new Date(),
        approvedBy: 'system-seed'
      });
      manager.approved = true; // Update local object for later use
    }
    
    managers.push(manager);
  }

  // Create regular users
  const users = [];
  for (let i = 0; i < 50; i++) {
    const name = generateRandomName();
    const city = indianCities[Math.floor(Math.random() * indianCities.length)];
    
    const user = await User.create({
      role: 'user',
      name,
      email: generateEmail(name),
      phone: generatePhoneNumber(),
      passwordHash,
      area: city,
      addresses: [{
        label: 'Home',
        line1: `${Math.floor(Math.random() * 999) + 1}, Residential Area`,
        line2: `${city} Suburb`,
        city,
        state: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat'][Math.floor(Math.random() * 5)],
        pincode: `${Math.floor(Math.random() * 900000) + 100000}`,
        isDefault: true
      }],
      approved: true
    });
    
    users.push(user);
  }

  console.log(`✅ Created ${admins.length} admins, ${managers.length} managers, and ${users.length} users`);
  return { admins, managers, users };
}

async function seedServices(categories: any[], managers: any[]) {
  console.log('🛠️ Seeding services...');
  
  const subcategories = await Subcategory.find({}).populate('categoryId');
  const services = [];
  
  for (const manager of managers) {
    if (!manager.approved) continue;
    
    // Each manager gets 2-4 services
    const serviceCount = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < serviceCount; i++) {
      const subcategory = subcategories[Math.floor(Math.random() * subcategories.length)];
      const basePrice = Math.floor(Math.random() * 50000) + 5000;
      const commissionOffered = Math.floor(Math.random() * 15) + 5; // 5-20%
      
      const serviceTitles = {
        'wedding-planning': ['Premium Wedding Planning', 'Luxury Wedding Coordination', 'Complete Wedding Management'],
        'photography-videography': ['Professional Wedding Photography', 'Cinematic Wedding Films', 'Portrait Photography Sessions'],
        'catering-services': ['Royal Catering Services', 'Gourmet Food Experience', 'Traditional Cuisine Catering'],
        'entertainment': ['Premium DJ Services', 'Live Entertainment', 'Professional Anchoring'],
        'decoration-flowers': ['Royal Decoration Services', 'Floral Paradise', 'Elegant Event Decor'],
        'transportation': ['Luxury Car Rentals', 'Premium Transportation', 'Wedding Car Services']
      };
      
      const categorySlug = (subcategory.categoryId as any).slug;
      const titles = serviceTitles[categorySlug] || ['Professional Event Service'];
      const title = titles[Math.floor(Math.random() * titles.length)];
      
      const service = await Service.create({
        managerId: manager._id,
        categoryId: subcategory.categoryId,
        subcategoryId: subcategory._id,
        title: `${title} - ${manager.area}`,
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${manager.area.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        description: `Professional ${subcategory.name} services in ${manager.area}. We provide high-quality services with attention to detail and customer satisfaction. Our experienced team ensures your event is memorable and perfectly executed.`,
        shortDescription: `Professional ${subcategory.name} services in ${manager.area}`,
        basePrice,
        commissionOffered,
        commissionStatus: 'pending',
        areaServed: [manager.area, ...indianCities.slice(0, 3).filter(city => city !== manager.area)],
        maxCapacity: Math.floor(Math.random() * 500) + 100,
        features: [
          'Professional Service',
          'Experienced Team',
          'Quality Assurance',
          'Timely Delivery',
          'Customer Support'
        ].slice(0, Math.floor(Math.random() * 3) + 3),
        tags: [subcategory.name, manager.area, 'professional', 'quality'],
        media: [
          {
            type: 'image',
            url: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 1000)}`,
            thumbUrl: `https://picsum.photos/300/200?random=${Math.floor(Math.random() * 1000)}`,
            caption: `${subcategory.name} Service`,
            isMain: true
          },
          {
            type: 'image',
            url: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 1000)}`,
            thumbUrl: `https://picsum.photos/300/200?random=${Math.floor(Math.random() * 1000)}`,
            caption: 'Service Gallery'
          }
        ],
        priceTiers: [
          { label: 'small', price: basePrice * 0.7, description: 'Basic package', capacity: 50 },
          { label: 'medium', price: basePrice, description: 'Standard package', capacity: 150 },
          { label: 'large', price: basePrice * 1.5, description: 'Premium package', capacity: 300 }
        ],
        addOns: [
          { name: 'Extra Decoration', price: Math.floor(basePrice * 0.1), description: 'Additional decorative elements' },
          { name: 'Extended Service Hours', price: Math.floor(basePrice * 0.15), description: 'Service beyond standard hours' },
          { name: 'Premium Package Upgrade', price: Math.floor(basePrice * 0.2), description: 'Upgrade to premium service level' }
        ],
        location: {
          address: `${Math.floor(Math.random() * 999) + 1}, Business District`,
          city: manager.area,
          state: 'Maharashtra',
          pincode: `${Math.floor(Math.random() * 900000) + 100000}`,
          coordinates: [77.5946 + (Math.random() - 0.5) * 2, 12.9716 + (Math.random() - 0.5) * 2]
        },
        contactInfo: {
          phone: manager.phone,
          email: manager.email,
          whatsapp: manager.phone
        },
        businessHours: {
          monday: { open: '09:00', close: '18:00', isOpen: true },
          tuesday: { open: '09:00', close: '18:00', isOpen: true },
          wednesday: { open: '09:00', close: '18:00', isOpen: true },
          thursday: { open: '09:00', close: '18:00', isOpen: true },
          friday: { open: '09:00', close: '18:00', isOpen: true },
          saturday: { open: '10:00', close: '16:00', isOpen: true },
          sunday: { open: '10:00', close: '14:00', isOpen: false }
        },
        portfolio: [
          {
            title: 'Recent Wedding Project',
            description: `Successful ${subcategory.name} project completed in ${manager.area}`,
            images: [
              `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
              `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`
            ],
            completedAt: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))
          }
        ],
        status: Math.random() > 0.1 ? 'approved' : 'pending',
        isActive: true,
        ratingAverage: 3.5 + Math.random() * 1.5,
        ratingCount: Math.floor(Math.random() * 50) + 5,
        reviewCount: Math.floor(Math.random() * 30) + 3,
        specifications: {
          experience: Math.floor(Math.random() * 10) + 2,
          teamSize: Math.floor(Math.random() * 20) + 5,
          projectsCompleted: Math.floor(Math.random() * 100) + 20
        }
      });
      
      services.push(service);
    }
  }
  
  console.log(`✅ Created ${services.length} services`);
  return services;
}

async function seedCommissions(services: any[], admins: any[]) {
  console.log('💰 Seeding commissions...');
  
  const commissions = [];
  
  for (const service of services.slice(0, 20)) { // First 20 services get detailed commission records
    const admin = admins[Math.floor(Math.random() * admins.length)];
    const status = ['pending', 'negotiating', 'accepted', 'rejected'][Math.floor(Math.random() * 4)];
    
    const commission = await Commission.create({
      managerId: service.managerId,
      serviceId: service._id,
      offeredPercentage: service.commissionOffered,
      status,
      type: 'manager_offer',
      adminCounterPercentage: status === 'negotiating' ? Math.floor(Math.random() * 10) + 8 : undefined,
      adminNotes: status === 'negotiating' ? 'We can offer a counter proposal based on service quality and market standards.' : undefined,
      adminRespondedBy: status !== 'pending' ? admin._id : undefined,
      adminRespondedAt: status !== 'pending' ? new Date() : undefined,
      finalPercentage: status === 'accepted' ? (Math.floor(Math.random() * 5) + 10) : undefined,
      agreedAt: status === 'accepted' ? new Date() : undefined,
      agreedBy: status === 'accepted' ? admin._id : undefined,
      isActive: status === 'accepted',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      negotiationHistory: [
        {
          timestamp: new Date(Date.now() - 86400000), // 1 day ago
          action: 'offer',
          percentage: service.commissionOffered,
          notes: 'Initial commission offer from manager',
          byUser: service.managerId,
          byRole: 'manager'
        }
      ]
    });
    
    if (status === 'negotiating' || status === 'accepted') {
      commission.addNegotiationEntry(
        status === 'accepted' ? 'accept' : 'counter',
        admin._id,
        'admin',
        commission.adminCounterPercentage,
        commission.adminNotes
      );
      await commission.save();
    }
    
    commissions.push(commission);
  }
  
  console.log(`✅ Created ${commissions.length} commission records`);
  return commissions;
}

async function seedRequirements(users: any[], categories: any[]) {
  console.log('📋 Seeding requirements...');
  
  const subcategories = await Subcategory.find({});
  const requirements = [];
  
  for (let i = 0; i < 30; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const subcategory = subcategories[Math.floor(Math.random() * subcategories.length)];
    const city = indianCities[Math.floor(Math.random() * indianCities.length)];
    
    const requirement = await Requirement.create({
      userId: user._id,
      title: `Looking for ${subcategory.name} in ${city}`,
      description: `I need professional ${subcategory.name} services for my upcoming event. Please provide quotes with detailed breakdown and availability.`,
      categoryId: subcategory.categoryId,
      subcategoryId: subcategory._id,
      location: {
        area: city,
        city,
        coordinates: {
          latitude: 12.9716 + (Math.random() - 0.5) * 10,
          longitude: 77.5946 + (Math.random() - 0.5) * 10
        }
      },
      attendeesCapacity: Math.floor(Math.random() * 300) + 50,
      budget: {
        min: Math.floor(Math.random() * 20000) + 10000,
        max: Math.floor(Math.random() * 50000) + 30000
      },
      timeframe: {
        startDate: new Date(Date.now() + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + Math.floor(Math.random() * 120 + 90) * 24 * 60 * 60 * 1000),
        flexible: Math.random() > 0.3
      },
      status: ['active', 'closed'][Math.floor(Math.random() * 2)],
      media: [
        {
          type: 'image',
          url: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
          thumbnail: `https://picsum.photos/200/150?random=${Math.floor(Math.random() * 1000)}`
        }
      ]
    });
    
    requirements.push(requirement);
  }
  
  console.log(`✅ Created ${requirements.length} requirements`);
  return requirements;
}

async function seedRequirementQuotes(requirements: any[], managers: any[], services: any[]) {
  console.log('💬 Seeding requirement quotes...');
  
  const quotes = [];
  
  for (const requirement of requirements) {
    if (requirement.status === 'closed') continue;
    
    // Each requirement gets 2-5 quotes
    const quoteCount = Math.floor(Math.random() * 4) + 2;
    const selectedManagers = managers
      .filter(m => m.approved)
      .sort(() => 0.5 - Math.random())
      .slice(0, quoteCount);
    
    for (const manager of selectedManagers) {
      const managerServices = services.filter(s => s.managerId.toString() === manager._id.toString());
      const relevantService = managerServices.find(s => 
        s.categoryId.toString() === requirement.categoryId.toString()
      ) || managerServices[0];
      
      if (!relevantService) continue;
      
      const price = Math.floor(Math.random() * 40000) + 15000;
      
      const quote = await RequirementQuote.create({
        requirementId: requirement._id,
        managerId: manager._id,
        serviceId: relevantService._id,
        price,
        notes: `We can provide excellent ${requirement.title} services. Our team has extensive experience and we guarantee quality work within your budget and timeline.`,
        availability: {
          startDate: requirement.timeframe.startDate,
          endDate: requirement.timeframe.endDate,
          notes: 'We are available for your preferred dates'
        },
        status: ['pending', 'accepted', 'rejected'][Math.floor(Math.random() * 3)],
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        inCart: Math.random() > 0.8 // 20% chance of being in cart
      });
      
      quotes.push(quote);
    }
  }
  
  console.log(`✅ Created ${quotes.length} requirement quotes`);
  return quotes;
}

async function seedOrders(users: any[], services: any[], managers: any[]) {
  console.log('📦 Seeding orders...');
  
  const orders = [];
  
  // Only proceed if we have services
  if (services.length === 0) {
    console.log('⚠️ No services available, skipping order creation');
    return orders;
  }
  
  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const service = services[Math.floor(Math.random() * services.length)];
    const manager = managers.find(m => m._id.toString() === service.managerId.toString());
    
    if (!manager || !service.priceTiers || service.priceTiers.length === 0) continue;
    
    const tier = service.priceTiers[Math.floor(Math.random() * service.priceTiers.length)];
    const qty = Math.floor(Math.random() * 2) + 1;
    const subtotal = tier.price * qty;
    const fee = Math.floor(subtotal * 0.02); // 2% platform fee
    const tax = Math.floor(subtotal * 0.18); // 18% GST
    const total = subtotal + fee + tax;
    
    const status = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'][Math.floor(Math.random() * 5)];
    
    const order = await OrderModel.create({
      userId: user._id.toString(),
      managerId: manager._id.toString(),
      serviceId: service._id.toString(),
      items: [{
        serviceId: service._id.toString(),
        tierLabel: tier.label,
        qty,
        unitPrice: tier.price,
        addOns: service.addOns.slice(0, Math.floor(Math.random() * 2)),
        notes: 'Please coordinate for the event date and venue details'
      }],
      subtotal,
      fee,
      tax,
      total,
      status,
      addressSnapshot: user.addresses?.[0] || {
        label: 'Event Venue',
        line1: 'Event Location',
        city: user.area,
        state: 'Maharashtra',
        pincode: '400001'
      },
      scheduledAt: new Date(Date.now() + Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString(),
      payment: {
        provider: 'razorpay',
        orderId: `order_${Math.floor(Math.random() * 1000000)}`,
        paymentId: status !== 'pending' ? `pay_${Math.floor(Math.random() * 1000000)}` : undefined,
        status: status === 'pending' ? 'created' : status === 'cancelled' ? 'failed' : 'paid'
      },
      timeline: [
        {
          at: new Date().toISOString(),
          by: user._id.toString(),
          action: 'Order placed',
          note: 'Order has been placed successfully'
        }
      ]
    });
    
    orders.push(order);
  }
  
  console.log(`✅ Created ${orders.length} orders`);
  return orders;
}

async function seedReviews(orders: any[], users: any[], services: any[]) {
  console.log('⭐ Seeding reviews...');
  
  const reviews = [];
  const completedOrders = orders.filter(order => order.status === 'completed');
  
  for (const order of completedOrders.slice(0, 30)) { // Review first 30 completed orders
    const user = users.find(u => u._id.toString() === order.userId);
    const service = services.find(s => s._id.toString() === order.serviceId);
    
    if (!user || !service) continue;
    
    const rating = Math.floor(Math.random() * 2) + 4; // 4-5 star ratings mostly
    const comments = [
      'Excellent service! Highly recommend.',
      'Great quality work and professional team.',
      'Very satisfied with the service provided.',
      'Good value for money. Will book again.',
      'Professional service with attention to detail.',
      'Timely delivery and great customer service.',
      'Exceeded our expectations. Thank you!'
    ];
    
    const review = await ReviewModel.create({
      orderId: order._id.toString(),
      serviceId: service._id.toString(),
      userId: user._id.toString(),
      rating,
      comment: comments[Math.floor(Math.random() * comments.length)]
    });
    
    reviews.push(review);
  }
  
  console.log(`✅ Created ${reviews.length} reviews`);
  return reviews;
}

async function seedNotifications(users: any[], orders: any[]) {
  console.log('🔔 Seeding notifications...');
  
  const notifications = [];
  
  for (const user of users.slice(0, 30)) {
    const userOrders = orders.filter(order => order.userId === user._id.toString());
    
    for (const order of userOrders.slice(0, 2)) {
      const notificationTypes = [
        { type: 'order_confirmed', title: 'Order Confirmed', body: `Your order #${order._id.toString().slice(-6)} has been confirmed.` },
        { type: 'order_update', title: 'Order Update', body: `Your order status has been updated to ${order.status}.` },
        { type: 'payment_received', title: 'Payment Received', body: 'Your payment has been successfully processed.' }
      ];
      
      const notifType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      
      const notification = await NotificationModel.create({
        userId: user._id.toString(),
        title: notifType.title,
        body: notifType.body,
        type: notifType.type,
        data: { orderId: order._id.toString() },
        read: Math.random() > 0.3 // 70% read
      });
      
      notifications.push(notification);
    }
  }
  
  console.log(`✅ Created ${notifications.length} notifications`);
  return notifications;
}

async function seedChats(orders: any[], users: any[], managers: any[]) {
  console.log('💬 Seeding chats and messages...');
  
  const chats = [];
  const messages = [];
  
  for (const order of orders.slice(0, 20)) {
    const user = users.find(u => u._id.toString() === order.userId);
    const manager = managers.find(m => m._id.toString() === order.managerId);
    
    if (!user || !manager) continue;
    
    const chat = await ChatModel.create({
      orderId: order._id.toString(),
      userId: user._id.toString(),
      managerId: manager._id.toString(),
      participants: [user._id.toString(), manager._id.toString()],
      lastMessageAt: new Date().toISOString()
    });
    
    chats.push(chat);
    
    // Create some messages for this chat
    const messageCount = Math.floor(Math.random() * 5) + 2;
    for (let j = 0; j < messageCount; j++) {
      const isUserMessage = j % 2 === 0;
      const sender = isUserMessage ? user : manager;
      const messageTexts = isUserMessage ? [
        'Hi, I wanted to discuss about my order.',
        'Can you provide more details about the service?',
        'What time will you arrive at the venue?',
        'Thank you for the quick response.'
      ] : [
        'Hello! Thank you for your order.',
        'We will provide all the details shortly.',
        'We will arrive 2 hours before the event time.',
        'You\'re welcome! Happy to help.'
      ];
      
      const message = await MessageModel.create({
        chatId: chat._id.toString(),
        senderId: sender._id.toString(),
        type: 'text',
        content: messageTexts[Math.floor(Math.random() * messageTexts.length)],
        readBy: Math.random() > 0.3 ? [sender._id.toString()] : []
      });
      
      messages.push(message);
    }
  }
  
  console.log(`✅ Created ${chats.length} chats and ${messages.length} messages`);
  return { chats, messages };
}

async function seedCarts(users: any[], services: any[]) {
  console.log('🛒 Seeding carts...');
  
  const carts = [];
  
  for (const user of users.slice(0, 15)) { // 15 users have items in cart
    const cartItems = [];
    const itemCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < itemCount; i++) {
      const service = services[Math.floor(Math.random() * services.length)];
      const tier = service.priceTiers[Math.floor(Math.random() * service.priceTiers.length)];
      
      cartItems.push({
        serviceId: service._id,
        tierLabel: tier.label,
        qty: Math.floor(Math.random() * 2) + 1,
        priceAtAdd: tier.price,
        notes: 'Added to cart for future booking'
      });
    }
    
    const subtotal = cartItems.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
    
    const cart = await CartModel.create({
      userId: user._id,
      items: cartItems,
      subtotal,
      total: subtotal
    });
    
    carts.push(cart);
  }
  
  console.log(`✅ Created ${carts.length} carts`);
  return carts;
}

async function updateServiceCounts() {
  console.log('📊 Updating service counts...');
  
  // Update category service counts
  const categories = await Category.find({});
  for (const category of categories) {
    const count = await Service.countDocuments({ categoryId: category._id, status: 'approved' });
    await Category.findByIdAndUpdate(category._id, { serviceCount: count });
  }
  
  // Update subcategory service counts
  const subcategories = await Subcategory.find({});
  for (const subcategory of subcategories) {
    const count = await Service.countDocuments({ subcategoryId: subcategory._id, status: 'approved' });
    await Subcategory.findByIdAndUpdate(subcategory._id, { serviceCount: count });
  }
  
  console.log('✅ Updated service counts');
}

async function comprehensiveSeed() {
  try {
    console.log('🌱 Starting comprehensive seed process...\n');
    
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Clear existing data
    await clearDatabase();
    
    // Seed in correct order to maintain relationships
    const { categories } = await seedCategories();
    const { admins, managers, users } = await seedUsers();
    const services = await seedServices(categories, managers);
    const commissions = await seedCommissions(services, admins);
    const requirements = await seedRequirements(users, categories);
    const quotes = await seedRequirementQuotes(requirements, managers, services);
    const orders = await seedOrders(users, services, managers);
    const reviews = await seedReviews(orders, users, services);
    const notifications = await seedNotifications(users, orders);
    const { chats, messages } = await seedChats(orders, users, managers);
    const carts = await seedCarts(users, services);
    
    // Update counts
    await updateServiceCounts();
    
    console.log('\n🎉 COMPREHENSIVE SEED COMPLETED SUCCESSFULLY!');
    console.log('\n📊 Summary:');
    console.log(`📂 Categories: ${categories.length}`);
    console.log(`📝 Subcategories: ${await Subcategory.countDocuments({})}`);
    console.log(`👥 Total Users: ${admins.length + managers.length + users.length}`);
    console.log(`   - Admins: ${admins.length}`);
    console.log(`   - Managers: ${managers.length}`);
    console.log(`   - Users: ${users.length}`);
    console.log(`🛠️  Services: ${services.length}`);
    console.log(`💰 Commissions: ${commissions.length}`);
    console.log(`📋 Requirements: ${requirements.length}`);
    console.log(`💬 Requirement Quotes: ${quotes.length}`);
    console.log(`📦 Orders: ${orders.length}`);
    console.log(`⭐ Reviews: ${reviews.length}`);
    console.log(`🔔 Notifications: ${notifications.length}`);
    console.log(`💬 Chats: ${chats.length}`);
    console.log(`📨 Messages: ${messages.length}`);
    console.log(`🛒 Carts: ${carts.length}`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('Admin: admin@planor.com / password123');
    console.log('Manager: (check generated managers) / password123');
    console.log('User: (check generated users) / password123');
    
    console.log('\n✅ Ready to use the complete Planor application!');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the comprehensive seed
comprehensiveSeed();
