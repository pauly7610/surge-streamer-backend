
# Surge Streamer Backend

A backend system for predicting Uber surge pricing based on various factors like location, time, weather, and demand.

## Project Overview

This project provides the backend infrastructure for the Surge Streamer application, offering data storage, authentication, and surge prediction algorithms. It connects to a Supabase database for persistent storage and user management.

### Features

- Real-time surge prediction calculations
- User authentication and account management
- Ride history tracking and analytics
- Weather data integration for better predictions
- API endpoints for frontend integration
- Real-time driver location tracking

## Backend API Endpoints

The backend provides several API endpoints:

- **Authentication**: Email/password signup and login
- **Surge Prediction**: Calculate surge pricing for a given location
- **Ride Requests**: Create, update, and track ride requests
- **Driver Location**: Real-time location updates for drivers

## Database Structure

- **users**: Store user account information
- **drivers**: Store driver-specific information
- **ride_requests**: Track all ride requests
- **driver_locations**: Track real-time driver locations
- **surge_predictions**: Store surge pricing predictions
- **payments**: Track payment information for rides

## Tech Stack

- React with TypeScript (admin interface)
- Tailwind CSS for styling
- shadcn/ui component library
- Supabase for backend services and database

## GitHub Repository

**URL**: https://github.com/pauly7610/surge-streamer-backend

### How to edit this code

If you want to work locally using your own IDE, you can clone this repo and push changes:

```sh
# Clone the repository
git clone https://github.com/pauly7610/surge-streamer-backend.git

# Navigate to the project directory
cd surge-streamer-backend

# Install dependencies
npm i

# Start the development server
npm run dev
```

## Backend Services

The backend uses Supabase Edge Functions to implement key functionality:

1. **predict-surge**: Calculate surge pricing for a given location
2. **driver-location**: Update and retrieve driver locations
3. **ride-request**: Create and manage ride requests

All endpoints are secured with JWT authentication where appropriate and implement proper error handling.
