# Planor Backend Seed Scripts

This directory contains various seed scripts to populate the Planor database with sample data.

## Available Scripts

### 1. Comprehensive Seed (`comprehensive-seed.ts`)
**Most Complete** - Seeds the entire application with realistic data across all models.

```bash
npm run seed:comprehensive
```

**What it creates:**
- **Categories & Subcategories**: 6 main categories (Wedding Planning, Photography, Catering, Entertainment, Decoration, Transportation) with 25+ subcategories
- **Users**: 
  - 2 Admin users
  - 25 Managers with detailed profiles, bank details, addresses
  - 50 Regular users with addresses
- **Services**: 50+ services with media, pricing tiers, add-ons, portfolios, commission settings
- **Commissions**: Detailed commission negotiations between managers and admins
- **Requirements**: 30 customer requirements with quotes from multiple managers
- **Orders**: 50 sample orders with different statuses and payment information
- **Reviews**: Reviews for completed orders
- **Notifications**: System notifications for users
- **Chats & Messages**: Communication between users and managers
- **Carts**: Shopping carts with items for active users

**Login Credentials:**
- Admin: `admin@planor.com` / `password123`
- Manager: Check console output for generated emails / `password123`
- User: Check console output for generated emails / `password123`

### 2. Basic Seed (`seed.ts`)
Basic seed with minimal data for development.

```bash
npm run seed
```

### 3. Enhanced Data Seed (`seedEnhancedData.ts`)
Seeds enhanced service data with rich metadata.

### 4. Verification Script (`verify-seed.ts`)
Verifies and displays seeded data.

```bash
npm run verify:seed
```

### 5. Service Management CLI (`manage-services.ts`)
Interactive CLI to manually add and manage services.

```bash
npm run manage:services
```

## Usage Instructions

1. **First Time Setup:**
   ```bash
   # Make sure your .env file is configured with MONGO_URI
   # Run comprehensive seed for complete app data
   npm run seed:comprehensive
   ```

2. **Verify Data:**
   ```bash
   npm run verify:seed
   ```

3. **Add More Services (Optional):**
   ```bash
   npm run manage:services
   ```

## Database Models Covered

- ✅ Users (customers, managers, admins)
- ✅ Categories & Subcategories  
- ✅ Services with full details
- ✅ Commission system
- ✅ Requirements & Quotes
- ✅ Orders & Payments
- ✅ Reviews & Ratings
- ✅ Notifications
- ✅ Chat system
- ✅ Shopping Cart

## Features Included

### Service Features:
- Multiple pricing tiers (small, medium, large)
- Add-on services
- Rich media galleries
- Portfolio projects
- Business hours
- Contact information
- Location data with coordinates
- Service specifications
- Areas served
- Commission negotiations

### User Features:
- Role-based access (admin, manager, user)
- Profile management
- Address management
- Bank details for managers
- Business profiles for managers
- Verification status

### Order Features:
- Complete order workflow
- Payment integration setup
- Status tracking
- Timeline management
- Address snapshots

### Communication Features:
- Real-time chat system
- Requirement-based quotes
- Notification system
- Review and rating system

## Notes

- All users have password: `password123`
- Generated data includes realistic Indian names, cities, and phone numbers
- Services span multiple categories relevant to event planning
- Commission percentages range from 5-20%
- Orders have various statuses for testing different workflows
- Sample media URLs use placeholder images
- All relationships between models are properly maintained

## Troubleshooting

If you encounter connection issues:
```bash
npm run check:connection
```

If you need to clear and re-seed:
```bash
npm run seed:comprehensive
```

The comprehensive seed script automatically clears existing data before seeding new data.
