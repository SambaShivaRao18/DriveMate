 
const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/ServiceRequest");

// Reverse geocode coordinates to address
async function reverseGeocode(latitude, longitude) {
    try {
        console.log(`📍 Reverse geocoding: ${latitude}, ${longitude}`);
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );
        
        if (!response.ok) {
            throw new Error('Reverse geocoding service unavailable');
        }
        
        const data = await response.json();
        
        if (data && data.display_name) {
            console.log('✅ Reverse geocoding successful:', data.display_name);
            return data.display_name;
        } else {
            throw new Error('Could not determine address from coordinates');
        }
        
    } catch (error) {
        console.error('❌ Reverse geocoding error:', error);
        // Fallback: return coordinates-based address
        return `Near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
}

// @desc   Show provider registration page
exports.showProviderRegister = async (req, res) => {
    try {
        // Check if provider already registered
        const existingProvider = await ServiceProvider.findOne({ user: req.user._id });
        
        if (existingProvider) {
            // If already registered, redirect to dashboard
            return res.redirect('/provider/dashboard');
        }

        res.render('pages/provider-register', { 
            user: req.user,
            error: null 
        });

    } catch (error) {
        console.error('Provider register page error:', error);
        res.status(500).render('error', { error: 'Failed to load registration page' });
    }
};

// @desc   Register service provider
exports.registerProvider = async (req, res) => {
    try {
        const {
            businessName,
            address,
            phone,
            email,
            services,
            assistanceFee,
            travelFeePerKm,
            petrolPrice,
            dieselPrice,
            cngPrice,
            latitude,
            longitude
        } = req.body;

        const user = req.user;

        // Check if provider already registered
        const existingProvider = await ServiceProvider.findOne({ user: user._id });
        if (existingProvider) {
            return res.status(400).render('pages/provider-register', {
                user: req.user,
                error: "You are already registered as a service provider"
            });
        }

        // VALIDATE COORDINATES
        if (!latitude || !longitude) {
            return res.status(400).render('pages/provider-register', {
                user: req.user,
                error: "Latitude and longitude are required"
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        // Validate coordinate ranges (Hyderabad area roughly)
        if (lat < 17.3 || lat > 17.6 || lng < 78.3 || lng > 78.5) {
            return res.status(400).render('pages/provider-register', {
                user: req.user,
                error: "Coordinates appear to be outside Hyderabad area. Please check and try again."
            });
        }

        // Get accurate address from coordinates
        let businessAddress = address;
        if (!businessAddress || businessAddress.trim() === '') {
            businessAddress = await reverseGeocode(lat, lng);
        }

        const providerData = {
            user: user._id,
            businessName,
            businessType: user.role,
            address: businessAddress, // Auto-filled from reverse geocoding
            location: {
                type: 'Point',
                coordinates: [lng, lat] // [longitude, latitude]
            },
            phone,
            email,
            pricing: {
                assistanceFee: parseFloat(assistanceFee),
                travelFeePerKm: parseFloat(travelFeePerKm)
            },
            isVerified: true,
            isAvailable: true
        };

        // Add service-specific data
        if (user.role === 'mechanic') {
            providerData.services = Array.isArray(services) ? services : [services];
        } else if (user.role === 'fuel-station') {
            providerData.pricing.fuelPrices = {
                petrol: parseFloat(petrolPrice) || 0,
                diesel: parseFloat(dieselPrice) || 0,
                cng: parseFloat(cngPrice) || 0
            };
        }

        const provider = new ServiceProvider(providerData);
        await provider.save();

        console.log(`✅ Provider registered: ${businessName} at ${businessAddress}`);
        res.redirect('/provider/dashboard');

    } catch (error) {
        console.error('Provider registration error:', error);
        res.status(500).render('pages/provider-register', {
            user: req.user,
            error: "Registration failed: " + error.message
        });
    }
};

// @desc   Show provider dashboard
exports.showProviderDashboard = async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id })
            .populate('user', 'name email phone');
            
        if (!provider) {
            // If provider not registered yet, redirect to registration
            return res.redirect('/provider/register');
        }

        // Get nearby requests for this provider
        const nearbyRequests = await ServiceRequest.find({
            serviceType: provider.businessType === 'fuel-station' ? 'fuel' : 'mechanic',
            status: 'pending'
        })
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .limit(10);

        res.render('pages/provider-dashboard', {
            user: req.user,
            provider: provider,
            nearbyRequests: nearbyRequests
        });

    } catch (error) {
        console.error('Provider dashboard error:', error);
        res.status(500).render('error', { error: 'Failed to load dashboard' });
    }
};

// @desc   Get provider profile (API endpoint - keep for frontend)
exports.getProviderProfile = async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id });

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: "Provider profile not found"
            });
        }

        res.json({
            success: true,
            provider
        });

    } catch (error) {
        console.error("Get provider profile error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get provider profile"
        });
    }
};