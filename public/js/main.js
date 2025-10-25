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
    const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    modal.show();
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
    if (paymentMethod !== 'cash' && !transactionId) {
        showAlert('Please enter transaction ID', 'warning');
        return;
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
                transactionId: paymentMethod !== 'cash' ? transactionId : undefined
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
    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', function () {
            const transactionField = document.getElementById('transactionIdField');
            if (this.value !== 'cash') {
                transactionField.style.display = 'block';
            } else {
                transactionField.style.display = 'none';
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