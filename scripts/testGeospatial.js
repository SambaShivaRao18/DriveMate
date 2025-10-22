const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const testGeospatial = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check ServiceProvider collection
    const providerIndexes = await mongoose.connection.collection('serviceproviders').getIndexes();
    console.log('📊 ServiceProvider indexes:', Object.keys(providerIndexes));

    // Check ServiceRequest collection  
    const requestIndexes = await mongoose.connection.collection('servicerequests').getIndexes();
    console.log('📊 ServiceRequest indexes:', Object.keys(requestIndexes));

    // Test a sample query
    console.log('🧪 Testing geospatial query...');
    const testProviders = await mongoose.connection.collection('serviceproviders')
      .find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [78.4867, 17.3850] // Hyderabad
            },
            $maxDistance: 20000
          }
        }
      })
      .limit(3)
      .toArray();

    console.log(`✅ Found ${testProviders.length} providers in test query`);
    console.log('Sample providers:', testProviders.map(p => ({
      name: p.businessName,
      type: p.businessType,
      location: p.location
    })));

    process.exit(0);
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
};

testGeospatial();