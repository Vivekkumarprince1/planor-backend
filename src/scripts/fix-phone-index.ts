/**
 * Migration script to fix phone field index issue
 * Run this once to fix the duplicate key error on phone field
 */

import { MongoClient } from 'mongodb';
import { env } from '../config/env';

async function migratePhoneIndex() {
  const client = new MongoClient(env.MONGO_URI as string);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Drop the existing phone index if it exists
    try {
      await usersCollection.dropIndex('phone_1');
      console.log('✅ Dropped old phone index');
    } catch (error: any) {
      if (error.codeName === 'IndexNotFound') {
        console.log('ℹ️  No existing phone index to drop');
      } else {
        console.log('⚠️  Error dropping phone index:', error.message);
      }
    }
    
    // Create a sparse unique index on phone field
    // This allows multiple documents with null/undefined phone values
    await usersCollection.createIndex(
      { phone: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'phone_sparse_unique'
      }
    );
    console.log('✅ Created sparse unique index on phone field');
    
    // Remove any duplicate null phone entries
    const duplicateNullPhones = await usersCollection.find({ phone: null }).toArray();
    if (duplicateNullPhones.length > 1) {
      console.log(`Found ${duplicateNullPhones.length} users with null phone`);
      
      // Keep the first one, remove phone field from others
      for (let i = 1; i < duplicateNullPhones.length; i++) {
        await usersCollection.updateOne(
          { _id: duplicateNullPhones[i]._id },
          { $unset: { phone: "" } }
        );
        console.log(`✅ Removed null phone from user ${duplicateNullPhones[i]._id}`);
      }
    }
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migratePhoneIndex()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migratePhoneIndex };
