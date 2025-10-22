const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');

dotenv.config();

const sampleProviders = [
  // Fuel Stations
  {
    businessName: "Shell Fuel Station",
    businessType: "fuel-station",
    services: ["petrol", "diesel", "cng"],
    address: "123 Main Road, City Center",
    location: {
      type: "Point",
      coordinates: [78.4867, 17.3850] // Hyderabad coordinates
    },
    phone: "+919876543210",
    email: "shell@example.com",
    pricing: {
      assistanceFee: 120,
      travelFeePerKm: 12,
      fuelPrices: {
        petrol: 97.5,
        diesel: 90.2,
        cng: 76.8
      }
    },
    operatingHours: {
      open: "06:00",
      close: "22:00"
    }
  },
  {
    businessName: "BP Fuel Point",
    businessType: "fuel-station",
    services: ["petrol", "diesel"],
    address: "456 Market Street, Downtown",
    location: {
      type: "Point",
      coordinates: [78.4767, 17.3950]
    },
    phone: "+919876543211",
    email: "bp@example.com",
    pricing: {
      assistanceFee: 100,
      travelFeePerKm: 10,
      fuelPrices: {
        petrol: 96.8,
        diesel: 89.5,
        cng: 0
      }
    },
    operatingHours: {
      open: "05:00",
      close: "23:00"
    }
  },
  {
    businessName: "Reliance Fuel Center",
    businessType: "fuel-station",
    services: ["petrol", "diesel", "cng"],
    address: "789 Business Park, Tech Area",
    location: {
      type: "Point",
      coordinates: [78.4667, 17.3750]
    },
    phone: "+919876543212",
    email: "reliance@example.com",
    pricing: {
      assistanceFee: 150,
      travelFeePerKm: 15,
      fuelPrices: {
        petrol: 98.2,
        diesel: 91.0,
        cng: 78.5
      }
    },
    operatingHours: {
      open: "24 hours"
    }
  },
  // Mechanics
  {
    businessName: "City Auto Repair",
    businessType: "mechanic",
    services: ["engine repair", "tyre change", "battery replacement", "general service"],
    address: "321 Service Road, Industrial Area",
    location: {
      type: "Point",
      coordinates: [78.4967, 17.3950]
    },
    phone: "+919876543213",
    email: "cityauto@example.com",
    pricing: {
      assistanceFee: 200,
      travelFeePerKm: 15
    },
    operatingHours: {
      open: "08:00",
      close: "20:00"
    }
  },
  {
    businessName: "Quick Fix Mechanics",
    businessType: "mechanic",
    services: ["tyre puncture", "battery jumpstart", "fuel delivery", "lockout service"],
    address: "654 Fast Lane, Commercial Zone",
    location: {
      type: "Point",
      coordinates: [78.4567, 17.3650]
    },
    phone: "+919876543214",
    email: "quickfix@example.com",
    pricing: {
      assistanceFee: 180,
      travelFeePerKm: 12
    },
    operatingHours: {
      open: "07:00",
      close: "21:00"
    }
  },
  {
    businessName: "Pro Car Services",
    businessType: "mechanic",
    services: ["engine diagnostics", "electrical repair", "ac service", "brake repair"],
    address: "987 Expert Road, Service Zone",
    location: {
      type: "Point",
      coordinates: [78.4867, 17.4050]
    },
    phone: "+919876543215",
    email: "procar@example.com",
    pricing: {
      assistanceFee: 250,
      travelFeePerKm: 20
    },
    operatingHours: {
      open: "09:00",
      close: "18:00"
    }
  }
];

const createSampleProviders = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing sample providers
    await ServiceProvider.deleteMany({ 
      email: { $in: sampleProviders.map(p => p.email) } 
    });
    console.log('✅ Cleared existing sample providers');

    // Create a dummy user for providers (in real app, each provider would have their own user account)
    let dummyUser = await User.findOne({ email: 'provider_dummy@example.com' });
    
    if (!dummyUser) {
      dummyUser = await User.create({
        name: 'Provider Dummy',
        email: 'provider_dummy@example.com',
        password: 'password123',
        phone: '+910000000000',
        role: 'mechanic' // This doesn't matter for our sample data
      });
      console.log('✅ Created dummy user for providers');
    }

    // Create sample providers
    const providersWithUser = sampleProviders.map(provider => ({
      ...provider,
      user: dummyUser._id,
      isVerified: true,
      isAvailable: true,
      rating: Math.random() * 2 + 3, // Random rating between 3-5
      totalRatings: Math.floor(Math.random() * 50) + 10 // Random ratings count
    }));

    const createdProviders = await ServiceProvider.insertMany(providersWithUser);
    console.log(`✅ Created ${createdProviders.length} sample providers`);

    // Display created providers
    createdProviders.forEach(provider => {
      console.log(`🏪 ${provider.businessName} - ${provider.businessType}`);
      console.log(`   📍 ${provider.location.coordinates}`);
      console.log(`   📞 ${provider.phone}`);
      console.log(`   ⭐ Rating: ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)`);
      console.log('---');
    });

    console.log('🎉 Sample data creation completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating sample providers:', error);
    process.exit(1);
  }
};

createSampleProviders();