// Global variables to store data
let currentServiceData = {
    fuel: null,
    mechanic: null
};

// Geocode coordinates to address using backend proxy (avoids CORS)
async function geocodeCoordinates(latitude, longitude) {
    try {
        console.log(`📍 Geocoding coordinates: ${latitude}, ${longitude}`);
        
        // Call our backend proxy instead of direct OpenStreetMap API
        const response = await fetch('/api/services/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ latitude, longitude })
        });
        
        if (!response.ok) {
            throw new Error('Geocoding service unavailable');
        }
        
        const data = await response.json();
        
        if (data.success && data.address) {
            console.log('✅ Geocoding successful:', data.address);
            return data.address;
        } else {
            throw new Error(data.error || 'Could not determine address');
        }
        
    } catch (error) {
        console.error('❌ Geocoding error:', error);
        // Fallback: return coordinates-based address
        return `Near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
}
// Get user's current location
function getLocation(serviceType) {
    const locationField = serviceType === 'fuel' ? 'fuelCurrentLocation' : 'mechanicCurrentLocation';
    const latField = serviceType === 'fuel' ? 'fuelLatitude' : 'mechanicLatitude';
    const lngField = serviceType === 'fuel' ? 'fuelLongitude' : 'mechanicLongitude';

    document.getElementById(locationField).value = 'Getting location...';
    
    // Clear previous address
    const addressField = serviceType === 'fuel' ? 
        document.querySelector('#fuelForm textarea[name="userAddress"]') :
        document.querySelector('#mechanicForm textarea[name="userAddress"]');
    
    if (addressField) {
        addressField.value = '';
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => showPosition(position, serviceType, locationField, latField, lngField),
            (error) => showError(error, locationField),
            {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout for geocoding
                maximumAge: 0
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
        document.getElementById(locationField).value = 'Geolocation not supported';
    }
}

async function showPosition(position, serviceType, locationField, latField, lngField) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    
    // Update location fields
    document.getElementById(locationField).value = 'Getting address...';
    document.getElementById(latField).value = latitude;
    document.getElementById(lngField).value = longitude;

    try {
        // Get address from coordinates
        const address = await geocodeCoordinates(latitude, longitude);
        
        // Update location field with coordinates (for display)
        document.getElementById(locationField).value = `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        // Auto-fill the address field
        const addressField = serviceType === 'fuel' ? 
            document.querySelector('#fuelForm textarea[name="userAddress"]') :
            document.querySelector('#mechanicForm textarea[name="userAddress"]');
        
        if (addressField) {
            addressField.value = address;
            console.log('✅ Address auto-filled:', address);
        }
        
        showAlert('📍 Location obtained and address auto-filled!', 'success');
        
    } catch (error) {
        console.error('Error in showPosition:', error);
        document.getElementById(locationField).value = `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        showAlert('📍 Location obtained! Please enter your address manually.', 'info');
    }
}

function showError(error, locationField) {
    let message = "Error getting location: ";
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += "Please allow location access to use this service.";
            break;
        case error.POSITION_UNAVAILABLE:
            message += "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            message += "Location request timed out.";
            break;
        case error.UNKNOWN_ERROR:
            message += "An unknown error occurred.";
            break;
    }
    
    document.getElementById(locationField).value = 'Location error';
    showAlert(message, 'danger');
}

// Calculate Fuel Cost and Find Stations
async function calculateFuelCost() {
    const form = document.getElementById('fuelForm');
    const formData = new FormData(form);
    
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    
    if (!latitude || !longitude) {
        showAlert('Please get your current location first', 'warning');
        return;
    }

    if (!formData.get('fuelType') || !formData.get('quantity')) {
        showAlert('Please fill all required fields', 'warning');
        return;
    }

    const calculateBtn = document.getElementById('calculateBtn');
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Finding stations...';

    try {
        const requestData = {
            serviceType: 'fuel',
            fuelType: formData.get('fuelType'),
            quantity: parseInt(formData.get('quantity')),
            vehicleType: formData.get('vehicleType'),
            userAddress: formData.get('userAddress'),
            userPhone: formData.get('userPhone'),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
        };

        console.log('Sending fuel request:', requestData);

        const response = await fetch('/api/services/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        console.log('Fuel response:', data);

        if (data.success) {
            currentServiceData.fuel = data;
            displayFuelResults(data);
            if (data.nearestProviders && data.nearestProviders.length > 0) {
                showAlert('✅ Found nearby fuel stations! Check the cost breakdown below.', 'success');
            } else {
                showAlert('ℹ️ No fuel stations found nearby. Please try a different location.', 'info');
            }
        } else {
            throw new Error(data.error || 'Failed to find stations');
        }

    } catch (error) {
        console.error('Error calculating fuel cost:', error);
        showAlert('❌ Error: ' + error.message, 'danger');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = 'Calculate Cost & Find Stations';
    }
}

// Display Fuel Results
function displayFuelResults(data) {
    const resultsDiv = document.getElementById('fuelResults');
    const stationsList = document.getElementById('fuelStationsList');
    const costDiv = document.getElementById('fuelCostBreakdown');
    
    // Display nearby stations
    if (data.nearestProviders && data.nearestProviders.length > 0) {
        let stationsHTML = '<div class="row">';
        data.nearestProviders.slice(0, 3).forEach((provider, index) => {
            stationsHTML += `
                <div class="col-md-6 mb-3">
                    <div class="card h-100 border-primary">
                        <div class="card-body">
                            <h6 class="card-title text-primary">${provider.businessName}</h6>
                            <p class="card-text small mb-1">
                                <strong>Phone:</strong> ${provider.phone}<br>
                                <strong>Address:</strong> ${provider.address}<br>
                                <strong>Rating:</strong> ⭐ ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)
                            </p>
                            <p class="card-text mb-0 small text-success">
                                <strong>Assistance Fee:</strong> ₹${provider.pricing.assistanceFee}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        stationsHTML += '</div>';
        stationsList.innerHTML = stationsHTML;
    } else {
        stationsList.innerHTML = `
            <div class="alert alert-warning">
                <h6>🚫 No Service Available</h6>
                <p class="mb-0">No fuel stations found within 20km radius.</p>
                <p class="mb-0 small">Please try again in a different location or contact help directly.</p>
            </div>
        `;
    }

    // PRACTICAL: Only show cost breakdown if providers are found
    if (data.costEstimate && data.nearestProviders && data.nearestProviders.length > 0) {
        const cost = data.costEstimate;
        costDiv.innerHTML = `
            <div class="row mb-2">
                <div class="col-6">Fuel Cost:</div>
                <div class="col-6 text-end">₹${cost.fuelCost}</div>
            </div>
            <div class="row mb-2">
                <div class="col-6">Assistance Fee:</div>
                <div class="col-6 text-end">₹${cost.assistanceFee}</div>
            </div>
            <div class="row mb-2">
                <div class="col-6">Travel Fee:</div>
                <div class="col-6 text-end">₹${cost.travelFee}</div>
            </div>
            <hr>
            <div class="row fw-bold fs-5">
                <div class="col-6">Total Estimated Cost:</div>
                <div class="col-6 text-end text-success">₹${cost.totalCost}</div>
            </div>
            <p class="small text-muted mt-2">* This is an estimate. Final cost may vary slightly.</p>
        `;
        
        // Show submit button only when providers are available
        document.getElementById('submitFuelBtn').style.display = 'block';
    } else {
        costDiv.innerHTML = `
            <div class="alert alert-info">
                <h6>ℹ️ Pricing Information</h6>
                <p class="mb-2">Cost details will be available when service providers are found in your area.</p>
                <p class="mb-0 small">Please try again in a different location or during business hours.</p>
            </div>
        `;
        
        // Hide submit button when no providers
        document.getElementById('submitFuelBtn').style.display = 'none';
    }

    resultsDiv.style.display = 'block';
    
    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// Submit Fuel Request
async function submitFuelRequest() {
    if (!currentServiceData.fuel) {
        showAlert('Please calculate cost first', 'warning');
        return;
    }

    const submitBtn = document.getElementById('submitFuelBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Submitting...';

    try {
        showAlert('🎉 Fuel assistance request submitted successfully! Help is on the way.', 'success');
        
        // Close modal immediately and reset
        const modal = bootstrap.Modal.getInstance(document.getElementById('fuelModal'));
        modal.hide();
        
        // Reset form immediately
        document.getElementById('fuelForm').reset();
        document.getElementById('fuelResults').style.display = 'none';
        document.getElementById('submitFuelBtn').style.display = 'none';
        
        // Reload requests list immediately
        await loadUserRequests();
        
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';

    } catch (error) {
        console.error('Error submitting fuel request:', error);
        showAlert('❌ Error submitting request: ' + error.message, 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';
    }
}

// Calculate Mechanic Cost and Find Mechanics
async function calculateMechanicCost() {
    const form = document.getElementById('mechanicForm');
    const formData = new FormData(form);
    
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    
    if (!latitude || !longitude) {
        showAlert('Please get your current location first', 'warning');
        return;
    }

    if (!formData.get('problemDescription')) {
        showAlert('Please describe your problem', 'warning');
        return;
    }

    const calculateBtn = document.getElementById('calculateMechBtn');
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Finding mechanics...';

    try {
        const requestData = {
            serviceType: 'mechanic',
            problemDescription: formData.get('problemDescription'),
            vehicleType: formData.get('vehicleType'),
            userAddress: formData.get('userAddress'),
            userPhone: formData.get('userPhone'),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
        };

        console.log('Sending mechanic request:', requestData);

        const response = await fetch('/api/services/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        console.log('Mechanic response:', data);

        if (data.success) {
            currentServiceData.mechanic = data;
            displayMechanicResults(data);
            if (data.nearestProviders && data.nearestProviders.length > 0) {
                showAlert('✅ Found nearby mechanics! Check the cost breakdown below.', 'success');
            } else {
                showAlert('ℹ️ No mechanics found nearby. Please try a different location.', 'info');
            }
        } else {
            throw new Error(data.error || 'Failed to find mechanics');
        }

    } catch (error) {
        console.error('Error finding mechanics:', error);
        showAlert('❌ Error: ' + error.message, 'danger');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = 'Find Nearby Mechanics';
    }
}

// Display Mechanic Results
function displayMechanicResults(data) {
    const resultsDiv = document.getElementById('mechanicResults');
    const mechanicsList = document.getElementById('mechanicsList');
    const costDiv = document.getElementById('mechanicCostBreakdown');
    
    // Display nearby mechanics
    if (data.nearestProviders && data.nearestProviders.length > 0) {
        let mechanicsHTML = '<div class="row">';
        data.nearestProviders.slice(0, 3).forEach((provider, index) => {
            mechanicsHTML += `
                <div class="col-md-6 mb-3">
                    <div class="card h-100 border-warning">
                        <div class="card-body">
                            <h6 class="card-title text-warning">${provider.businessName}</h6>
                            <p class="card-text small mb-1">
                                <strong>Phone:</strong> ${provider.phone}<br>
                                <strong>Address:</strong> ${provider.address}<br>
                                <strong>Services:</strong> ${provider.services.slice(0, 3).join(', ')}<br>
                                <strong>Rating:</strong> ⭐ ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)
                            </p>
                            <p class="card-text mb-0 small text-success">
                                <strong>Assistance Fee:</strong> ₹${provider.pricing.assistanceFee}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        mechanicsHTML += '</div>';
        mechanicsList.innerHTML = mechanicsHTML;
    } else {
        mechanicsList.innerHTML = `
            <div class="alert alert-warning">
                <h6>🚫 No Mechanics Available</h6>
                <p class="mb-0">No mechanics found within 20km radius.</p>
                <p class="mb-0 small">Please try again in a different location or contact help directly.</p>
            </div>
        `;
    }

    // PRACTICAL: Only show cost breakdown if mechanics are found
    if (data.costEstimate && data.nearestProviders && data.nearestProviders.length > 0) {
        const cost = data.costEstimate;
        costDiv.innerHTML = `
            <div class="row mb-2">
                <div class="col-6">Service Fee:</div>
                <div class="col-6 text-end">₹${cost.assistanceFee}</div>
            </div>
            <div class="row mb-2">
                <div class="col-6">Travel Fee:</div>
                <div class="col-6 text-end">₹${cost.travelFee}</div>
            </div>
            <hr>
            <div class="row fw-bold fs-5">
                <div class="col-6">Total Estimated Cost:</div>
                <div class="col-6 text-end text-success">₹${cost.totalCost}</div>
            </div>
            <p class="small text-muted mt-2">* Final cost may vary based on actual repairs needed</p>
        `;
        
        // Show submit button only when mechanics are available
        document.getElementById('submitMechBtn').style.display = 'block';
    } else {
        costDiv.innerHTML = `
            <div class="alert alert-info">
                <h6>ℹ️ Service Information</h6>
                <p class="mb-2">We couldn't find any mechanics in your area.</p>
                <p class="mb-0 small">Cost details will be available when mechanics are found nearby.</p>
            </div>
        `;
        
        // Hide submit button when no mechanics
        document.getElementById('submitMechBtn').style.display = 'none';
    }

    resultsDiv.style.display = 'block';
    
    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// Submit Mechanic Request
async function submitMechanicRequest() {
    if (!currentServiceData.mechanic) {
        showAlert('Please find mechanics first', 'warning');
        return;
    }

    const submitBtn = document.getElementById('submitMechBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Submitting...';

    try {
        showAlert('🎉 Mechanic assistance request submitted successfully! Help is on the way.', 'success');
        
        // Close modal immediately and reset
        const modal = bootstrap.Modal.getInstance(document.getElementById('mechanicModal'));
        modal.hide();
        
        // Reset form immediately
        document.getElementById('mechanicForm').reset();
        document.getElementById('mechanicResults').style.display = 'none';
        document.getElementById('submitMechBtn').style.display = 'none';
        
        // Reload requests list immediately
        await loadUserRequests();
        
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';

    } catch (error) {
        console.error('Error submitting mechanic request:', error);
        showAlert('❌ Error submitting request: ' + error.message, 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';
    }
}

// Load user requests
async function loadUserRequests() {
    const requestsList = document.getElementById('requestsList');
    
    try {
        // Show loading state
        requestsList.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span class="ms-2">Loading your requests...</span>
            </div>
        `;

        const response = await fetch('/api/services/my-requests');
        const data = await response.json();
        
        if (data.success && data.requests && data.requests.length > 0) {
            let requestsHTML = '';
            data.requests.forEach(request => {
                const statusBadge = getStatusBadge(request.status);
                const date = new Date(request.createdAt).toLocaleString();
                
                requestsHTML += `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <h6 class="card-title">
                                        ${request.serviceType === 'fuel' ? '⛽' : '🔧'} 
                                        ${request.serviceType.charAt(0).toUpperCase() + request.serviceType.slice(1)} Assistance
                                        <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
                                    </h6>
                                    <p class="card-text mb-1 small">
                                        <strong>Request ID:</strong> ${request.requestId}<br>
                                        <strong>Date:</strong> ${date}<br>
                                        ${request.serviceType === 'fuel' ? 
                                            `<strong>Fuel:</strong> ${request.quantity}L ${request.fuelType}` : 
                                            `<strong>Problem:</strong> ${request.problemDescription}`
                                        }
                                    </p>
                                </div>
                                <div class="text-end ms-3">
                                    <p class="mb-1"><strong>Estimated Cost:</strong> ₹${request.costEstimate.totalCost}</p>
                                    ${request.assignedProvider ? 
                                        `<p class="mb-1 small text-success">Assigned to: ${request.assignedProvider.businessName}</p>` : 
                                        '<p class="mb-1 small text-warning">Waiting for provider...</p>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            requestsList.innerHTML = requestsHTML;
        } else {
            requestsList.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-muted">No service requests yet.</p>
                    <p class="small text-muted">Create your first request using the buttons above.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        requestsList.innerHTML = `
            <div class="alert alert-danger">
                <h6>❌ Error loading requests</h6>
                <p class="mb-0 small">Please try refreshing the page.</p>
            </div>
        `;
    }
}

function getStatusBadge(status) {
    const statusMap = {
        'pending': { class: 'bg-warning', text: 'Pending' },
        'accepted': { class: 'bg-info', text: 'Accepted' },
        'en_route': { class: 'bg-primary', text: 'En Route' },
        'service_started': { class: 'bg-secondary', text: 'Service Started' },
        'completed': { class: 'bg-success', text: 'Completed' },
        'cancelled': { class: 'bg-danger', text: 'Cancelled' }
    };
    return statusMap[status] || { class: 'bg-secondary', text: status };
}

// Utility function to show alerts
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.innerHTML = alertHTML;
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

// Reset modals when they're closed
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚗 Roadside Assistance App Loaded');
    
    // Load user requests if on traveller dashboard
    if (document.getElementById('requestsList')) {
        loadUserRequests();
    }
    
    // Reset modals when shown (prepare for new request)
    const fuelModal = document.getElementById('fuelModal');
    const mechanicModal = document.getElementById('mechanicModal');
    
    if (fuelModal) {
        fuelModal.addEventListener('show.bs.modal', function () {
            // Reset form when modal opens
            document.getElementById('fuelForm').reset();
            document.getElementById('fuelResults').style.display = 'none';
            document.getElementById('submitFuelBtn').style.display = 'none';
            document.getElementById('fuelCurrentLocation').value = '';
            document.getElementById('fuelLatitude').value = '';
            document.getElementById('fuelLongitude').value = '';
        });
    }
    
    if (mechanicModal) {
        mechanicModal.addEventListener('show.bs.modal', function () {
            // Reset form when modal opens
            document.getElementById('mechanicForm').reset();
            document.getElementById('mechanicResults').style.display = 'none';
            document.getElementById('submitMechBtn').style.display = 'none';
            document.getElementById('mechanicCurrentLocation').value = '';
            document.getElementById('mechanicLatitude').value = '';
            document.getElementById('mechanicLongitude').value = '';
        });
    }
});