const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const geocodingClient = mbxGeocoding({ accessToken: process.env.MAPBOX_ACCESS_TOKEN });

class MapboxService {
    // Forward geocoding (address to coordinates)
    async geocodeAddress(address) {
        try {
            const response = await geocodingClient.forwardGeocode({
                query: address,
                limit: 1
            }).send();

            if (response.body.features.length > 0) {
                const [lng, lat] = response.body.features[0].center;
                return { latitude: lat, longitude: lng };
            }
            return null;
        } catch (error) {
            console.error('Mapbox forward geocoding error:', error);
            return null;
        }
    }

    // Reverse geocoding (coordinates to address)
    async reverseGeocode(lat, lng) {
        try {
            const response = await geocodingClient.reverseGeocode({
                query: [lng, lat],
                limit: 1,
                types: ['address', 'place', 'poi']
            }).send();

            if (response.body.features.length > 0) {
                return response.body.features[0].place_name;
            }
            return null;
        } catch (error) {
            console.error('Mapbox reverse geocoding error:', error);
            return null;
        }
    }
}

module.exports = new MapboxService();