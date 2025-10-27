// Global variables to store data
let currentServiceData = {
    fuel: null,
    mechanic: null
};
let excludedProviders = [];

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

// Get user's current location - FIXED VERSION
function getLocation(serviceType) {
    const locationField = serviceType === 'fuel' ? 'fuelCurrentLocation' : 'mechanicCurrentLocation';
    const latField = serviceType === 'fuel' ? 'fuelLatitude' : 'mechanicLatitude';
    const lngField = serviceType === 'fuel' ? 'fuelLongitude' : 'mechanicLongitude';
    console.log(`📍 Getting location for ${serviceType}`);

    // Clear previous values
    document.getElementById(locationField).value = 'Getting location...';
    document.getElementById(latField).value = '';
    document.getElementById(lngField).value = '';

    // Clear address field - FIXED SELECTOR
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
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showAlert("Geolocation is not supported by this browser.", 'warning');
        document.getElementById(locationField).value = 'Geolocation not supported';
    }
}

// FIXED showPosition function - CORRECTED ADDRESS FIELD SELECTION
async function showPosition(position, serviceType, locationField, latField, lngField) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    console.log(`📍 Coordinates obtained: ${latitude}, ${longitude}`);

    // Update hidden fields FIRST
    document.getElementById(latField).value = latitude;
    document.getElementById(lngField).value = longitude;
    document.getElementById(locationField).value = 'Getting address...';

    try {
        // Get address from coordinates
        const address = await geocodeCoordinates(latitude, longitude);

        // Update location display field
        document.getElementById(locationField).value = `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        // FIXED: Correct address field selection
        const addressField = serviceType === 'fuel' ?
            document.querySelector('#fuelForm textarea[name="userAddress"]') :
            document.querySelector('#mechanicForm textarea[name="userAddress"]');

        if (addressField) {
            addressField.value = address;
            console.log('✅ Address auto-filled:', address);
        } else {
            console.error('❌ Address field not found for serviceType:', serviceType);
            // Fallback: try to find by ID or name
            const fallbackField = document.querySelector('textarea[name="userAddress"]');
            if (fallbackField) {
                fallbackField.value = address;
            }
        }

        showAlert('📍 Location obtained and address auto-filled!', 'success');
    } catch (error) {
        console.error('Error in showPosition:', error);
        // Fallback: just show coordinates
        document.getElementById(locationField).value = `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        // FIXED: Correct fallback address field selection
        const addressField = serviceType === 'fuel' ?
            document.querySelector('#fuelForm textarea[name="userAddress"]') :
            document.querySelector('#mechanicForm textarea[name="userAddress"]');

        if (addressField) {
            addressField.value = `Near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }

        showAlert('📍 Location obtained! Please verify the address.', 'info');
    }
}

function showError(error, locationField) {
    let message = "Error getting location: ";
    switch (error.code) {
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

// Display Fuel Results with enhanced provider cards
function displayFuelResults(data) {
    const resultsDiv = document.getElementById('fuelResults');
    const stationsList = document.getElementById('fuelStationsList');
    const costDiv = document.getElementById('fuelCostBreakdown');

    // Reset excluded providers when new results are shown
    excludedProviders = [];

    // Display nearby stations
    if (data.nearestProviders && data.nearestProviders.length > 0) {
        let stationsHTML = '<div class="row">';
        
        data.nearestProviders.forEach((provider, index) => {
            const hasPhotos = provider.businessPhotos && provider.businessPhotos.length > 0;
            const photoCount = hasPhotos ? provider.businessPhotos.length : 0;
            
            stationsHTML += `
                <div class="col-md-6 mb-3" id="provider-${provider._id}">
                    <div class="card h-100 border-primary provider-card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="card-title text-primary">${provider.businessName}</h6>
                                <button class="btn btn-outline-danger btn-sm" onclick="excludeProvider('${provider._id}')" title="Remove this provider">
                                    ❌
                                </button>
                            </div>
                            <p class="card-text small mb-1">
                                <strong>Phone:</strong> ${provider.phone}<br>
                                <strong>Address:</strong> ${provider.address}<br>
                                <strong>Distance:</strong> ${provider.distance} km<br>
                                <strong>Rating:</strong> ⭐ ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)
                            </p>
                            
                            <!-- Business Photos Section -->
                            ${hasPhotos ? `
                                <div class="business-photos-section mt-2">
                                    <button class="btn btn-outline-info btn-sm w-100" onclick="viewBusinessPhotos('${provider._id}')">
                                        📸 View Business Photos (${photoCount})
                                    </button>
                                </div>
                            ` : `
                                <div class="text-muted small mt-2">
                                    No business photos available
                                </div>
                            `}
                            
                            <p class="card-text mb-0 small text-success mt-2">
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
            
            <!-- Excluded Providers Info -->
            <div id="excludedProvidersInfo" class="mt-3" style="display: none;">
                <div class="alert alert-info">
                    <small>📝 Some providers have been excluded from your search.</small>
                </div>
            </div>
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

// Display Mechanic Results with enhanced provider cards
function displayMechanicResults(data) {
    const resultsDiv = document.getElementById('mechanicResults');
    const mechanicsList = document.getElementById('mechanicsList');
    const costDiv = document.getElementById('mechanicCostBreakdown');

    // Reset excluded providers when new results are shown
    excludedProviders = [];

    // Display nearby mechanics
    if (data.nearestProviders && data.nearestProviders.length > 0) {
        let mechanicsHTML = '<div class="row">';
        
        data.nearestProviders.forEach((provider, index) => {
            const hasPhotos = provider.businessPhotos && provider.businessPhotos.length > 0;
            const photoCount = hasPhotos ? provider.businessPhotos.length : 0;
            
            mechanicsHTML += `
                <div class="col-md-6 mb-3" id="provider-${provider._id}">
                    <div class="card h-100 border-warning provider-card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="card-title text-warning">${provider.businessName}</h6>
                                <button class="btn btn-outline-danger btn-sm" onclick="excludeProvider('${provider._id}')" title="Remove this provider">
                                    ❌
                                </button>
                            </div>
                            <p class="card-text small mb-1">
                                <strong>Phone:</strong> ${provider.phone}<br>
                                <strong>Address:</strong> ${provider.address}<br>
                                <strong>Distance:</strong> ${provider.distance} km<br>
                                <strong>Services:</strong> ${provider.services ? provider.services.slice(0, 3).join(', ') : 'General repairs'}<br>
                                <strong>Rating:</strong> ⭐ ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)
                            </p>
                            
                            <!-- Business Photos Section -->
                            ${hasPhotos ? `
                                <div class="business-photos-section mt-2">
                                    <button class="btn btn-outline-info btn-sm w-100" onclick="viewBusinessPhotos('${provider._id}')">
                                        📸 View Business Photos (${photoCount})
                                    </button>
                                </div>
                            ` : `
                                <div class="text-muted small mt-2">
                                    No business photos available
                                </div>
                            `}
                            
                            <p class="card-text mb-0 small text-success mt-2">
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
            
            <!-- Excluded Providers Info -->
            <div id="excludedProvidersInfo" class="mt-3" style="display: none;">
                <div class="alert alert-info">
                    <small>📝 Some providers have been excluded from your search.</small>
                </div>
            </div>
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
    if (!requestsList) return;
    // Show skeleton loader
    showSkeletonLoader(requestsList, 'requests');
    try {
        const response = await fetch('/api/services/my-requests');
        const data = await response.json();
        if (data.success && data.requests && data.requests.length > 0) {
            let requestsHTML = '';
            data.requests.forEach(request => {
                const statusBadge = getStatusBadge(request.status);
                const date = new Date(request.createdAt).toLocaleString();
                // Add payment and rating buttons
                const paymentButton = request.status === 'completed' && request.paymentStatus !== 'paid' ?
                    `<button class="btn btn-success btn-sm mt-1 btn-mobile" onclick="showPaymentModal('${request.requestId}', '${request.serviceType} - ${request.requestId}', ${request.costEstimate.totalCost})">
                        💰 Pay Now
                    </button>` : '';
                const ratingButton = request.status === 'completed' && request.paymentStatus === 'paid' && !request.rating ?
                    `<button class="btn btn-warning btn-sm mt-1 btn-mobile" onclick="showRatingModal('${request.requestId}')">
                        ⭐ Rate
                    </button>` : '';
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
                                    ${paymentButton}
                                    ${ratingButton}
                                </div>
                                <div class="text-end ms-3">
                                    <p class="mb-1"><strong>Estimated Cost:</strong> ₹${request.costEstimate.totalCost}</p>
                                    ${request.assignedProvider ?
                        `<p class="mb-1 small text-success">Assigned to: ${request.assignedProvider.businessName}</p>` :
                        '<p class="mb-1 small text-warning">Waiting for provider...</p>'
                    }
                                    ${request.paymentStatus === 'paid' ?
                        `<p class="mb-1 small text-success">💰 Payment Completed</p>` :
                        ''
                    }
                                    ${request.rating ?
                        `<p class="mb-1 small text-warning">⭐ Rated: ${request.rating}/5</p>` :
                        ''
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

// Enhanced loading states
function showSkeletonLoader(container, type = 'requests') {
    let skeletonHTML = '';
    if (type === 'requests') {
        skeletonHTML = `
            <div class="skeleton-card">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-text"></div>
                <div class="skeleton-line skeleton-text-short"></div>
            </div>
            <div class="skeleton-card">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-text"></div>
                <div class="skeleton-line skeleton-text-short"></div>
            </div>
        `;
    } else if (type === 'payments') {
        skeletonHTML = `
            <div class="skeleton-table">
                <div class="skeleton-line skeleton-table-row"></div>
                <div class="skeleton-line skeleton-table-row"></div>
                <div class="skeleton-line skeleton-table-row"></div>
            </div>
        `;
    }
    container.innerHTML = skeletonHTML;
}

// Payment and Rating Functions
async function loadPaymentHistory() {
    const paymentHistory = document.getElementById('paymentHistory');
    if (!paymentHistory) return;
    showSkeletonLoader(paymentHistory, 'payments');
    try {
        const response = await fetch('/api/payments/history');
        const data = await response.json();
        if (data.success && data.payments && data.payments.length > 0) {
            let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Date</th><th>Service</th><th>Provider</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>';
            data.payments.forEach(payment => {
                const date = new Date(payment.paidAt).toLocaleDateString();
                const serviceType = payment.request.serviceType;
                const providerName = payment.provider.businessName;
                html += `
                    <tr>
                        <td>${date}</td>
                        <td>${serviceType === 'fuel' ? '⛽ Fuel' : '🔧 Mechanic'}</td>
                        <td>${providerName}</td>
                        <td>₹${payment.amount}</td>
                        <td>${payment.paymentMethod}</td>
                        <td><span class="badge bg-success">${payment.status}</span></td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
            paymentHistory.innerHTML = html;
        } else {
            paymentHistory.innerHTML = '<p class="text-muted">No payment history found.</p>';
        }
    } catch (error) {
        console.error('Load payment history error:', error);
        paymentHistory.innerHTML = '<p class="text-danger">Error loading payment history</p>';
    }
}

// Show payment modal for completed service
function showPaymentModal(requestId, serviceDetails, amount) {
    document.getElementById('paymentRequestId').value = requestId;
    document.getElementById('paymentServiceDetails').textContent = serviceDetails;
    document.getElementById('paymentAmount').textContent = `₹${amount}`;

    // Reset form
    document.getElementById('paymentMethod').value = '';
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionIdField').style.display = 'none';
    document.getElementById('qrCodeSection').style.display = 'none';
    document.getElementById('processPaymentBtn').style.display = 'block';

    // Load provider QR code if available
    loadProviderQRCode(requestId);
    debugProviderData(requestId);

    const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    modal.show();
}

// Load provider QR code for the request
async function loadProviderQRCode(requestId) {
    try {
        const response = await fetch(`/api/services/request/${requestId}`);
        const data = await response.json();

        if (data.success && data.request.assignedProvider && data.request.assignedProvider.qrCode) {
            // Store provider info for later use
            window.currentProviderInfo = {
                qrCode: data.request.assignedProvider.qrCode.url,
                upiId: data.request.assignedProvider.upiId,
                businessName: data.request.assignedProvider.businessName
            };
        } else {
            window.currentProviderInfo = null;
        }
    } catch (error) {
        console.error('Error loading provider QR code:', error);
        window.currentProviderInfo = null;
    }
}


// Mark QR payment as completed
function markQRPaymentAsDone() {
    // Just show the process payment button, user will enter transaction ID in the field
    document.getElementById('processPaymentBtn').style.display = 'block';
    showAlert('✅ Please enter your UPI Transaction ID in the field above and click "Process Payment".', 'success');

    // Optional: Focus on the transaction ID field for better UX
    document.getElementById('transactionId').focus();
}

// Process payment
async function processPayment() {
    const requestId = document.getElementById('paymentRequestId').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const transactionId = document.getElementById('transactionId').value;
    const amountText = document.getElementById('paymentAmount').textContent;
    const amount = parseFloat(amountText.replace('₹', ''));

    if (!paymentMethod) {
        showAlert('Please select payment method', 'warning');
        return;
    }

    // Validate QR payment
    if (paymentMethod === 'qr') {
        if (!transactionId) {
            showAlert('Please enter transaction ID for QR payment', 'warning');
            return;
        }
        if (!window.currentProviderInfo || !window.currentProviderInfo.qrCode) {
            showAlert('QR code payment not available for this provider', 'warning');
            return;
        }
    }

    // Validate cash payment
    if (paymentMethod === 'cash') {
        if (!confirm('Please confirm that you have collected cash payment from the customer.')) {
            return;
        }
    }

    try {
        const response = await fetch('/api/payments/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestId,
                paymentMethod,
                amount,
                transactionId: paymentMethod === 'qr' ? transactionId : `CASH-${requestId}-${Date.now()}`
            })
        });

        const data = await response.json();
        if (data.success) {
            showAlert('✅ Payment processed successfully!', 'success');
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
            modal.hide();
            // Refresh data
            loadUserRequests();
            loadPaymentHistory();
            // Show rating modal after 1 second
            setTimeout(() => {
                showRatingModal(requestId);
            }, 1000);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Process payment error:', error);
        showAlert('Payment failed: ' + error.message, 'danger');
    }
}

// Show rating modal
function showRatingModal(requestId) {
    document.getElementById('ratingRequestId').value = requestId;
    // Reset stars
    document.querySelectorAll('.star').forEach(star => {
        star.textContent = '☆';
        star.style.color = '#6c757d';
    });
    document.getElementById('selectedRating').value = '';
    document.getElementById('reviewText').value = '';
    // Add star click events
    document.querySelectorAll('.star').forEach(star => {
        star.onclick = function () {
            const rating = parseInt(this.getAttribute('data-rating'));
            document.getElementById('selectedRating').value = rating;
            // Update star display
            document.querySelectorAll('.star').forEach((s, index) => {
                s.textContent = index < rating ? '★' : '☆';
                s.style.color = index < rating ? '#ffc107' : '#6c757d';
            });
        };
    });
    const modal = new bootstrap.Modal(document.getElementById('ratingModal'));
    modal.show();
}

// Submit rating
async function submitRating() {
    const requestId = document.getElementById('ratingRequestId').value;
    const rating = document.getElementById('selectedRating').value;
    const review = document.getElementById('reviewText').value;
    if (!rating) {
        showAlert('Please select a rating', 'warning');
        return;
    }
    try {
        const response = await fetch('/api/payments/rating', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestId,
                rating,
                review
            })
        });
        const data = await response.json();
        if (data.success) {
            showAlert('⭐ Thank you for your rating!', 'success');
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
            modal.hide();
            // Refresh requests
            loadUserRequests();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Submit rating error:', error);
        showAlert('Rating failed: ' + error.message, 'danger');
    }
}

// Payment method change handler
function setupPaymentMethodHandler() {
    const paymentMethodSelect = document.getElementById('paymentMethod');
    const transactionField = document.getElementById('transactionIdField');
    const qrCodeSection = document.getElementById('qrCodeSection');
    const processPaymentBtn = document.getElementById('processPaymentBtn');

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', function () {
            if (this.value === 'qr') {
                // Show QR code section
                if (window.currentProviderInfo && window.currentProviderInfo.qrCode) {
                    document.getElementById('qrCodeImage').src = window.currentProviderInfo.qrCode;
                    document.getElementById('upiIdText').textContent = `UPI ID: ${window.currentProviderInfo.upiId || 'Not available'}`;
                    qrCodeSection.style.display = 'block';
                    transactionField.style.display = 'block';
                    processPaymentBtn.style.display = 'none'; // Hide process button initially
                    // Clear any previous transaction ID
                    document.getElementById('transactionId').value = '';
                } else {
                    alert('❌ QR code payment not available for this provider. Please select cash payment.');
                    this.value = '';
                    qrCodeSection.style.display = 'none';
                    transactionField.style.display = 'none';
                    processPaymentBtn.style.display = 'block';
                }
            }
            else if (this.value === 'cash') {
                qrCodeSection.style.display = 'none';
                transactionField.style.display = 'none';
                processPaymentBtn.style.display = 'block';
            } else {
                qrCodeSection.style.display = 'none';
                transactionField.style.display = 'none';
                processPaymentBtn.style.display = 'block';
            }
        });
    }
}

// Missing utility functions - ADDED
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

// Real-time request status updates
function startRequestPolling() {
    const requestsList = document.getElementById('requestsList');
    if (!requestsList) return;
    // Check for updates every 10 seconds
    setInterval(async () => {
        try {
            const response = await fetch('/api/services/my-requests');
            const data = await response.json();
            if (data.success && data.requests) {
                // Simple check - if request count changed, reload
                const currentCount = document.querySelectorAll('#requestsList .card').length;
                if (currentCount !== data.requests.length) {
                    console.log('🔄 Requests changed, refreshing...');
                    loadUserRequests();
                }
            }
        } catch (error) {
            console.log('Polling error:', error);
        }
    }, 10000); // 10 seconds
}

// Reset modals when they're closed
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚗 Roadside Assistance App Loaded');
    // Load user requests if on traveller dashboard
    if (document.getElementById('requestsList')) {
        loadUserRequests();
        startRequestPolling();
    }
    // Load payment history if on dashboard
    if (document.getElementById('paymentHistory')) {
        loadPaymentHistory();
    }
    // Setup payment method handler
    setupPaymentMethodHandler();
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

// Photo upload functionality
function previewPhotos(input) {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';

    if (input.files && input.files.length > 0) {
        const files = Array.from(input.files).slice(0, 5); // Limit to 5 files

        files.forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = function (e) {
                    const col = document.createElement('div');
                    col.className = 'col-6 col-md-4 mb-2';
                    col.innerHTML = `
                        <div class="photo-preview-card">
                            <img src="${e.target.result}" class="img-thumbnail" style="height: 100px; width: 100%; object-fit: cover;">
                            <small class="d-block text-center mt-1">Photo ${index + 1}</small>
                        </div>
                    `;
                    preview.appendChild(col);
                };

                reader.readAsDataURL(file);
            }
        });

        if (files.length > 0) {
            showAlert(`✅ ${files.length} photo(s) selected for upload`, 'info');
        }
    }
}

// Updated mechanic cost calculation to handle photo uploads
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
        // First, create the service request without photos
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

            // Upload photos if any were selected
            const photoFiles = document.getElementById('problemPhotos').files;
            if (photoFiles.length > 0) {
                await uploadProblemPhotos(data.request.requestId, photoFiles);
            }

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

// Upload photos after request creation
async function uploadProblemPhotos(requestId, photoFiles) {
    try {
        const formData = new FormData();

        // Add all photo files
        for (let i = 0; i < photoFiles.length; i++) {
            formData.append('photos', photoFiles[i]);
        }

        const response = await fetch(`/api/services/request/${requestId}/upload-photos`, {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header for FormData, browser does it automatically
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Photos uploaded successfully:', data.photos.length);
            showAlert(`📸 ${data.photos.length} problem photo(s) uploaded`, 'success');
        } else {
            console.warn('Photo upload warning:', data.error);
        }
    } catch (error) {
        console.error('Photo upload error:', error);
        // Don't fail the entire request if photo upload fails
        showAlert('⚠️ Service request created, but photo upload failed', 'warning');
    }
}
// Debug function to check provider data
async function debugProviderData(requestId) {
    try {
        const response = await fetch(`/api/services/request/${requestId}`);
        const data = await response.json();
        console.log('🔍 DEBUG - Full request data:', data);
        if (data.success && data.request.assignedProvider) {
            console.log('🔍 DEBUG - Provider data:', data.request.assignedProvider);
            console.log('🔍 DEBUG - QR Code exists:', data.request.assignedProvider.qrCode);
            console.log('🔍 DEBUG - UPI ID exists:', data.request.assignedProvider.upiId);
            console.log('🔍 DEBUG - Accepts QR Payments:', data.request.assignedProvider.acceptsQRPayments);
        } else {
            console.log('🔍 DEBUG - No assigned provider or request failed');
        }
    } catch (error) {
        console.error('🔍 DEBUG - Error:', error);
    }
}

// Exclude a provider from the list
function excludeProvider(providerId) {
    // Add to excluded providers list
    if (!excludedProviders.includes(providerId)) {
        excludedProviders.push(providerId);
    }
    
    // Hide the provider card with animation
    const providerCard = document.getElementById(`provider-${providerId}`);
    if (providerCard) {
        providerCard.style.transition = 'all 0.3s ease';
        providerCard.style.opacity = '0';
        providerCard.style.height = '0';
        providerCard.style.margin = '0';
        providerCard.style.padding = '0';
        providerCard.style.overflow = 'hidden';
        
        setTimeout(() => {
            providerCard.style.display = 'none';
        }, 300);
    }
    
    // Show excluded providers info
    const excludedInfo = document.getElementById('excludedProvidersInfo');
    if (excludedInfo) {
        excludedInfo.style.display = 'block';
    }
    
    showAlert('Provider removed from your search results', 'info');
}

// View business photos for a provider
function viewBusinessPhotos(providerId) {
    // Find the provider data from current service data
    let provider = null;
    let serviceType = null;
    
    if (currentServiceData.fuel && currentServiceData.fuel.nearestProviders) {
        provider = currentServiceData.fuel.nearestProviders.find(p => p._id === providerId);
        serviceType = 'fuel';
    }
    
    if (!provider && currentServiceData.mechanic && currentServiceData.mechanic.nearestProviders) {
        provider = currentServiceData.mechanic.nearestProviders.find(p => p._id === providerId);
        serviceType = 'mechanic';
    }
    
    if (!provider) {
        showAlert('Provider data not found', 'warning');
        return;
    }
    
    // Create and show business photos modal
    showBusinessPhotosModal(provider, serviceType);
}

// Show business photos modal
function showBusinessPhotosModal(provider, serviceType) {
    const photos = provider.businessPhotos || [];
    const hasPhotos = photos.length > 0;
    
    let photosHTML = '';
    
    if (hasPhotos) {
        photosHTML = `
            <div class="row">
                ${photos.map((photo, index) => `
                    <div class="col-12 col-md-6 mb-3">
                        <div class="card">
                            <img src="${photo.url}" class="card-img-top business-photo-modal" 
                                 style="height: 200px; object-fit: cover; cursor: pointer;"
                                 onclick="openFullSizePhoto('${photo.url}', '${photo.caption || `Business Photo ${index + 1}`}')"
                                 alt="${photo.caption || `Business Photo ${index + 1}`}">
                            <div class="card-body p-2">
                                <small class="text-muted">${photo.caption || `Business Photo ${index + 1}`}</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        photosHTML = `
            <div class="text-center py-4">
                <p class="text-muted">No business photos available for this provider.</p>
            </div>
        `;
    }
    
    const modalHTML = `
        <div class="modal fade" id="businessPhotosModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">🏢 ${provider.businessName} - Business Photos</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="provider-info mb-3 p-3 bg-light rounded">
                            <p class="mb-1"><strong>Business:</strong> ${provider.businessName}</p>
                            <p class="mb-1"><strong>Type:</strong> ${serviceType === 'fuel' ? '⛽ Fuel Station' : '🔧 Mechanic'}</p>
                            <p class="mb-1"><strong>Rating:</strong> ⭐ ${provider.rating.toFixed(1)} (${provider.totalRatings} reviews)</p>
                            <p class="mb-0"><strong>Address:</strong> ${provider.address}</p>
                        </div>
                        ${photosHTML}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-outline-danger" onclick="excludeProvider('${provider._id}'); bootstrap.Modal.getInstance(document.getElementById('businessPhotosModal')).hide();">
                            ❌ Remove This Provider
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('businessPhotosModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const businessPhotosModal = new bootstrap.Modal(document.getElementById('businessPhotosModal'));
    businessPhotosModal.show();
}

// Open full-size photo view
function openFullSizePhoto(photoUrl, caption) {
    const fullSizeModalHTML = `
        <div class="modal fade" id="fullSizePhotoModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h6 class="modal-title">${caption}</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${photoUrl}" class="img-fluid" style="max-height: 80vh;" alt="${caption}">
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('fullSizePhotoModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', fullSizeModalHTML);
    
    // Show modal
    const fullSizeModal = new bootstrap.Modal(document.getElementById('fullSizePhotoModal'));
    fullSizeModal.show();
}