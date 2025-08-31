import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Category, Subcategory } from '../src/models/Taxonomy';
import { Service } from '../src/models/Service';
import { User } from '../src/models/User';

export const seedEnhancedData = async () => {
  try {
    console.log('🌱 Seeding enhanced service data...');

    // Create sample categories with enhanced features
    const photographyCategory = await Category.findOneAndUpdate(
      { slug: 'photography' },
      {
        name: 'Photography',
        slug: 'photography',
        description: 'Professional photography services',
        icon: '📸',
        color: '#FF6B35',
        isActive: true,
        hasSubcategories: true,
        order: 1,
        metadata: {
          keywords: ['photography', 'photos', 'professional', 'camera'],
          seoTitle: 'Professional Photography Services',
          seoDescription: 'Find the best photographers for your special moments'
        },
        features: [
          'Professional Equipment',
          'High Resolution Images',
          'Photo Editing',
          'Online Gallery',
          'Print Services'
        ],
        requiredFields: [
          {
            fieldName: 'experience',
            fieldType: 'number',
            isRequired: true
          },
          {
            fieldName: 'equipment',
            fieldType: 'multiselect',
            isRequired: true
          }
        ]
      },
      { upsert: true, new: true }
    );

    const eventCategory = await Category.findOneAndUpdate(
      { slug: 'event-planning' },
      {
        name: 'Event Planning',
        slug: 'event-planning',
        description: 'Complete event planning and management services',
        icon: '🎉',
        color: '#4ECDC4',
        isActive: true,
        hasSubcategories: true,
        order: 5,
        metadata: {
          keywords: ['events', 'planning', 'wedding', 'party', 'celebration'],
          seoTitle: 'Professional Event Planning Services',
          seoDescription: 'Expert event planners for all your celebrations'
        },
        features: [
          'Event Coordination',
          'Vendor Management',
          'Decoration',
          'Catering Coordination',
          'Timeline Management'
        ]
      },
      { upsert: true, new: true }
    );

    // Create subcategories
    const weddingPhotography = await Subcategory.findOneAndUpdate(
      { slug: 'wedding-photography' },
      {
        categoryId: photographyCategory._id,
        name: 'Wedding Photography',
        slug: 'wedding-photography',
        description: 'Specialized wedding photography services',
        icon: '💒',
        isActive: true,
        order: 1,
        metadata: {
          keywords: ['wedding', 'bride', 'groom', 'ceremony', 'reception'],
          seoTitle: 'Wedding Photography Services',
          seoDescription: 'Capture your special day with professional wedding photographers'
        },
        features: [
          'Bridal Portraits',
          'Ceremony Coverage',
          'Reception Photography',
          'Couple Shoots',
          'Family Photos'
        ]
      },
      { upsert: true, new: true }
    );

    const portraitPhotography = await Subcategory.findOneAndUpdate(
      { slug: 'portrait-photography' },
      {
        categoryId: photographyCategory._id,
        name: 'Portrait Photography',
        slug: 'portrait-photography',
        description: 'Professional portrait and headshot photography',
        icon: '👤',
        isActive: true,
        order: 2
      },
      { upsert: true, new: true }
    );

    const weddingPlanning = await Subcategory.findOneAndUpdate(
      { slug: 'wedding-planning' },
      {
        categoryId: eventCategory._id,
        name: 'Wedding Planning',
        slug: 'wedding-planning',
        description: 'Complete wedding planning and coordination',
        icon: '💍',
        isActive: true,
        order: 1
      },
      { upsert: true, new: true }
    );

    // Create sample manager user
    const passwordHash = await bcrypt.hash('password123', 10);
    const sampleManager = await User.findOneAndUpdate(
      { email: 'manager@test.com' },
      {
        name: 'Test Manager',
        email: 'manager@test.com',
        passwordHash,
        role: 'manager',
        isActive: true
      },
      { upsert: true, new: true }
    );

    // Create enhanced services with rich media and features
    const weddingService = await Service.create({
      managerId: sampleManager._id,
      categoryId: photographyCategory._id,
      subcategoryId: weddingPhotography._id,
      title: 'Premium Wedding Photography Package',
      slug: 'premium-wedding-photography-package',
      description: 'Complete wedding photography coverage with professional editing, online gallery, and print options. Our experienced photographers capture every precious moment of your special day.',
      shortDescription: 'Professional wedding photography with full-day coverage and editing',
      media: [
        {
          type: 'image',
          url: 'https://example.com/wedding1.jpg',
          thumbUrl: 'https://example.com/wedding1_thumb.jpg',
          caption: 'Beautiful ceremony moments',
          description: 'Capturing the emotional moments during the wedding ceremony',
          isMain: true,
          tags: ['ceremony', 'bride', 'groom', 'emotional']
        },
        {
          type: 'image',
          url: 'https://example.com/wedding2.jpg',
          thumbUrl: 'https://example.com/wedding2_thumb.jpg',
          caption: 'Reception celebration',
          description: 'Fun and candid moments from the wedding reception',
          tags: ['reception', 'dancing', 'celebration', 'candid']
        },
        {
          type: 'video',
          url: 'https://example.com/wedding_highlight.mp4',
          thumbUrl: 'https://example.com/wedding_highlight_thumb.jpg',
          caption: 'Wedding highlight reel',
          description: '3-minute cinematic highlight reel of the entire wedding day',
          duration: 180,
          price: 5000,
          isPremium: true,
          tags: ['highlight', 'cinematic', 'video', 'premium']
        }
      ],
      mediaPackages: [
        {
          name: 'Basic Package',
          description: 'Essential wedding photos with basic editing',
          mediaItems: [], // Would contain media item IDs in real scenario
          price: 25000,
          isDefault: true
        },
        {
          name: 'Premium Package',
          description: 'Full coverage with cinematic video and premium editing',
          mediaItems: [], // Would contain all media item IDs
          price: 45000
        }
      ],
      basePrice: 25000,
      priceTiers: [
        {
          label: 'small',
          price: 25000,
          description: 'Up to 50 guests, 4 hours coverage',
          capacity: 50
        },
        {
          label: 'medium',
          price: 35000,
          description: 'Up to 150 guests, 6 hours coverage',
          capacity: 150
        },
        {
          label: 'large',
          price: 50000,
          description: 'Up to 300 guests, full day coverage',
          capacity: 300
        }
      ],
      addOns: [
        {
          name: 'Extra Hour Coverage',
          price: 3000,
          description: 'Additional hour of photography coverage'
        },
        {
          name: 'Drone Photography',
          price: 8000,
          description: 'Aerial shots with professional drone'
        },
        {
          name: 'Same Day Edit',
          price: 12000,
          description: 'Quick edit highlights for reception screening'
        }
      ],
      features: [
        'Professional DSLR Cameras',
        'Multiple Photographers',
        'Online Gallery Access',
        'High Resolution Images',
        'Professional Editing',
        'Print Release Included'
      ],
      specifications: {
        'Experience': '8+ years',
        'Equipment': 'Canon 5D Mark IV, Multiple Lenses',
        'Delivery Time': '2-3 weeks',
        'Image Count': '300-500 edited photos',
        'Backup Equipment': 'Yes',
        'Insurance': 'Professional liability covered'
      },
      tags: ['wedding', 'photography', 'professional', 'premium', 'full-day'],
      customFields: [
        {
          fieldName: 'experience',
          fieldType: 'number',
          fieldValue: 8,
          isRequired: true
        },
        {
          fieldName: 'equipment',
          fieldType: 'multiselect',
          fieldValue: ['Canon 5D Mark IV', 'Sony A7R IV', 'Various Lenses', 'Lighting Equipment'],
          isRequired: true
        }
      ],
      areaServed: ['Mumbai', 'Pune', 'Nashik', 'Aurangabad'],
      maxCapacity: 500,
      ratingAverage: 4.8,
      ratingCount: 45,
      reviewCount: 32,
      isActive: true,
      status: 'approved',
      location: {
        address: '123 Photography Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        coordinates: [72.8777, 19.0760] // Mumbai coordinates
      },
      contactInfo: {
        phone: '+91-9876543210',
        email: 'contact@premiumweddings.com',
        whatsapp: '+91-9876543210'
      },
      businessHours: {
        monday: { open: '09:00', close: '18:00', isOpen: true },
        tuesday: { open: '09:00', close: '18:00', isOpen: true },
        wednesday: { open: '09:00', close: '18:00', isOpen: true },
        thursday: { open: '09:00', close: '18:00', isOpen: true },
        friday: { open: '09:00', close: '18:00', isOpen: true },
        saturday: { open: '08:00', close: '20:00', isOpen: true },
        sunday: { open: '08:00', close: '20:00', isOpen: true }
      },
      portfolio: [
        {
          title: 'Rajesh & Priya Wedding',
          description: 'Beautiful traditional Indian wedding with 300 guests',
          images: ['portfolio1.jpg', 'portfolio2.jpg', 'portfolio3.jpg'],
          completedAt: new Date('2024-12-15')
        },
        {
          title: 'Amit & Sneha Reception',
          description: 'Modern reception party with contemporary photography style',
          images: ['portfolio4.jpg', 'portfolio5.jpg'],
          completedAt: new Date('2024-11-20')
        }
      ]
    });

    // Create a portrait photography service
    await Service.create({
      managerId: sampleManager._id,
      categoryId: photographyCategory._id,
      subcategoryId: portraitPhotography._id,
      title: 'Professional Portrait & Headshot Photography',
      slug: 'professional-portrait-headshot-photography',
      description: 'High-quality portrait and headshot photography for professionals, actors, and personal use. Studio and outdoor options available.',
      shortDescription: 'Professional portraits and headshots for all occasions',
      media: [
        {
          type: 'image',
          url: 'https://example.com/portrait1.jpg',
          caption: 'Professional business headshot',
          description: 'Clean, professional headshot perfect for LinkedIn and business cards',
          isMain: true,
          tags: ['headshot', 'business', 'professional']
        }
      ],
      basePrice: 3500,
      priceTiers: [
        {
          label: 'small',
          price: 3500,
          description: 'Single person, 5 edited photos',
          capacity: 1
        },
        {
          label: 'medium',
          price: 6000,
          description: 'Single person, 15 edited photos + outfit changes',
          capacity: 1
        }
      ],
      features: [
        'Professional Lighting Setup',
        'Multiple Outfit Changes',
        'Retouching Included',
        'High Resolution Files',
        'Quick Turnaround'
      ],
      specifications: {
        'Session Duration': '1-2 hours',
        'Photos Delivered': '5-15 edited images',
        'Turnaround Time': '3-5 days',
        'Format': 'High-res JPEG + RAW on request'
      },
      tags: ['portrait', 'headshot', 'professional', 'studio'],
      areaServed: ['Mumbai', 'Thane'],
      status: 'approved',
      isActive: true
    });

    console.log('✅ Enhanced service data seeded successfully!');
    console.log(`📸 Created ${await Category.countDocuments()} categories`);
    console.log(`📂 Created ${await Subcategory.countDocuments()} subcategories`);
    console.log(`🛠️ Created ${await Service.countDocuments()} services`);

  } catch (error) {
    console.error('❌ Error seeding enhanced data:', error);
    throw error;
  }
};
