# 🚗 DriveMate – Real-Time Roadside Assistance Platform

DriveMate is a full-stack web application that connects travellers with nearby fuel stations and mechanics in real time. It provides on-demand roadside help with live location detection, provider assignment, digital payments, and transparent service tracking.

## ✨ Features

### 🔐 Multi-User Roles
- Travellers: Request roadside assistance  
- Fuel Stations & Mechanics: Accept and manage service requests  

### 📍 Smart Provider Matching
- MongoDB Geospatial Queries to find nearest providers (20km radius)
- Mapbox based location services

### ⏱️ Real-Time Service Workflow
**Pending → Accepted → En-Route → Service Started → Completed**

### 📸 Image Uploads
- Travellers upload vehicle issue photos  
- Providers upload shop photos & QR code  
- Cloudinary storage

### 💳 Payment System
- Cash & UPI QR-based payments  
- Provider earnings tracking  

### ⭐ Ratings System
- Travellers rate service experience  

---

## 🛠️ Tech Stack

| Category  | Technologies |
|----------|-------------|
| Backend  | Node.js, Express.js |
| Database | MongoDB Atlas (Geospatial) |
| Frontend | EJS, Bootstrap |
| Auth     | JWT |
| Storage  | Cloudinary |
| Maps     | Mapbox API |
| Deployment | Render.com |

## 📦 Installation

```bash
git clone https://github.com/SambaShivaRao18/DriveMate.git
cd DriveMate
npm install
```

## 🔧 Environment Setup

Create a `.env` file:

```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## ▶️ Run Application

```bash
npm start
```

App URL: `http://localhost:5000`

## 🌐 Deployment
- Backend deployed on **Render.com**
- Database hosted on **MongoDB Atlas**

## 🤝 Contributing
Pull requests are welcome.

## 🙌 Acknowledgements
- Mapbox for geolocation APIs  
- Cloudinary for media storage  
- MongoDB Atlas for cloud database  

## 🔗 LinkedIn Post

I shared the detailed project breakdown on LinkedIn 🚀  

<a href="https://www.linkedin.com/feed/update/urn:li:activity:7391415618241216512/" target="_blank">
  <img src="https://img.shields.io/badge/View%20Project%20Post-LinkedIn-blue?style=for-the-badge&logo=linkedin" />
</a>

(Feel free to check it out & drop feedback! 🙌)
