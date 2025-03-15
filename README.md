# Surge Streamer Backend

A backend system for predicting Uber surge pricing based on various factors like location, time, weather, and demand.

## Project Overview

This project provides the backend infrastructure for the Surge Streamer application, offering data storage, authentication, and surge prediction algorithms. It connects to a Supabase database for persistent storage and user management, while implementing a sophisticated real-time data streaming architecture.

### Features

- Real-time surge prediction calculations
- User authentication and account management
- Ride history tracking and analytics
- Weather data integration for better predictions
- API endpoints for frontend integration
- Real-time driver location tracking
- Hexagonal geospatial grid for location-based analysis
- Time-series analysis for prediction trends

## System Architecture

The backend follows a stream processing architecture with the following components:

```
                                  ┌─────────────────┐
                                  │  External Data  │
                                  │     Sources     │
                                  └────────┬────────┘
                                           │
                                           ▼
 ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
 │   Data Source   │             │   Data Stream   │             │  Data Processing │
 │   Connectors    │─────────────▶    Pipeline     │─────────────▶     Engine      │
 └─────────────────┘             └─────────────────┘             └────────┬────────┘
                                                                          │
                                                                          ▼
 ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
 │    Frontend     │             │    Supabase     │             │  Prediction &    │
 │   Application   │◀────────────│   Edge Functions │◀────────────│  Storage Layer  │
 └─────────────────┘             └─────────────────┘             └─────────────────┘
```

### Component Breakdown

1. **Data Source Connectors**: Interfaces with external data sources
2. **Data Stream Pipeline**: Manages the flow of real-time data
3. **Data Processing Engine**: Processes and transforms incoming data
4. **Prediction & Storage Layer**: Applies prediction algorithms and stores results
5. **Supabase Edge Functions**: Serves processed data to the frontend
6. **Frontend Application**: React/TypeScript application (separate repository)

## Backend API Endpoints

The backend provides several API endpoints via Supabase Edge Functions:

- **predict-surge**: Calculate surge pricing for a given location

  - `POST /functions/v1/predict-surge`
  - Parameters: `latitude`, `longitude`, `timestamp` (optional), `predictionHorizon` (optional)

- **driver-location**: Update and retrieve driver locations

  - `POST /functions/v1/driver-location`
  - Parameters: `driverId`, `latitude`, `longitude`, `heading`, `isAvailable`

- **ride-request**: Create and manage ride requests
  - `POST /functions/v1/ride-request`
  - Parameters: `riderId`, `pickupLatitude`, `pickupLongitude`, `destinationLatitude`, `destinationLongitude`

## Database Structure

- **users**: Store user account information
- **drivers**: Store driver-specific information
- **ride_requests**: Track all ride requests
- **driver_locations**: Track real-time driver locations
- **surge_predictions**: Store surge pricing predictions
- **payments**: Track payment information for rides

## Tech Stack

- TypeScript for type safety
- Supabase for backend services and database
- RxJS for reactive stream processing
- Hexagonal grid system for geospatial analysis
- Supabase Edge Functions for serverless API endpoints

## GitHub Repository

**URL**: https://github.com/pauly7610/surge-streamer-backend

### How to run this project

```sh
# Clone the repository
git clone https://github.com/pauly7610/surge-streamer-backend.git

# Navigate to the project directory
cd surge-streamer-backend

# Install dependencies
npm i

# Start the Supabase local development
npm run dev

# Build the TypeScript code
npm run build

# Start the data pipeline
npm run start:pipeline

# Deploy Supabase functions
npm run deploy
```

## Data Pipeline

The data pipeline processes information from multiple sources to generate surge predictions:

1. **Ride Requests**: User ride requests indicate demand in specific areas
2. **Driver Locations**: Driver positions and availability indicate supply
3. **Weather Data**: Weather conditions affect ride demand
4. **Traffic Conditions**: Traffic affects driver availability and ride times
5. **Event Calendar**: Special events create demand spikes in specific areas

The pipeline aggregates this data by time windows and geographic areas, calculates supply/demand ratios, and generates surge predictions that are stored in Supabase for retrieval by the frontend.
