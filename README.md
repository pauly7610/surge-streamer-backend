# Surge Streamer Backend

A sophisticated real-time surge pricing prediction system for transportation networks.

## Features

- **Advanced ML Prediction Engine**

  - Multi-algorithm consensus approach (LSTM, ARIMA, Gradient Boosting)
  - Confidence scoring for predictions
  - Automated model training and evaluation

- **Geospatial Analysis**

  - H3 hexagonal geospatial binning for precise location-based predictions
  - Dynamic driver positioning recommendations
  - Geospatial clustering for demand hotspots

- **Comprehensive Feature Engineering**

  - Weather impact analysis (temperature, precipitation, wind)
  - Traffic congestion integration
  - Event proximity and impact calculation
  - Time-based cyclical encoding (hour of day, day of week)
  - Historical surge pattern analysis

- **Real-time Data Processing**

  - Kafka streaming for real-time data ingestion and prediction distribution
  - MongoDB for persistent storage of predictions and historical data
  - Efficient data normalization and preprocessing pipeline

- **Notification System**
  - Tiered notification based on prediction confidence (65%/75%/85%)
  - Dynamic price lock allocation
  - Multi-channel delivery support

## Architecture

This project implements a real-time data streaming system that collects, processes, and analyzes data from multiple sources to predict surge pricing for ride-sharing services. The architecture follows a modern event-driven design with the following components:

### Core Components

1. **Data Source Connectors**: Connect to various data sources and emit events

   - Ride Request API Connector
   - Weather API Connector
   - Traffic API Connector
   - Events API Connector

2. **Stream Processing Pipeline**: Processes and transforms data streams

   - Combines data from multiple sources
   - Aggregates data by geospatial grid cells
   - Applies transformations and enrichments

3. **Kafka Integration**: Provides reliable message delivery and stream processing

   - Topics for different data types
   - Producers and consumers for data flow

4. **Geospatial Processing**: Handles location-based data using H3 grid system

   - Converts lat/lng to H3 indexes
   - Performs geospatial operations and calculations

5. **ML Prediction Model**: Generates surge predictions based on processed data

   - Feature engineering
   - Model training and evaluation
   - Real-time prediction
   - Multi-algorithm consensus approach

6. **Storage Layer**: Persists data for analysis and model training

   - Time-series data storage
   - Historical data for model training
   - MongoDB for prediction storage

7. **API Layer**: Provides interfaces for clients
   - RESTful endpoints for predictions
   - Feedback collection for model improvement

### Data Flow

1. Data source connectors collect data from various APIs
2. Raw data is sent to Kafka topics
3. Stream processor aggregates and enriches data
4. Feature engineering transforms raw data into ML-ready features
5. ML models generate predictions with confidence scores
6. Predictions are stored in MongoDB and published to Kafka
7. Notification system delivers alerts based on confidence thresholds
8. Clients consume real-time predictions via API endpoints

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB
- Kafka
- TensorFlow.js
- Docker and Docker Compose (optional, for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/surge-streamer-backend.git
cd surge-streamer-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start required services (optional)
docker-compose up -d

# Build the project
npm run build

# Start the service
npm start
```

### Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

## Project Structure

```
src/
├── connectors/        # Data source connectors
├── pipeline/          # Stream processing pipeline
├── ml/                # Machine learning models and prediction
│   ├── models.ts      # ML model definitions
│   ├── featureEngineering.ts # Feature extraction and processing
│   └── trainModel.ts  # Model training utilities
├── services/          # Core services
│   ├── DataService.ts # Data access service
│   ├── LocationService.ts # Location management
│   └── PredictionService.ts # Prediction generation
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
│   ├── geospatial.ts  # Geospatial utilities
│   └── logger.ts      # Logging utilities
├── config/            # Configuration
└── index.ts           # Application entry point
```

### Adding a New Data Source

1. Create a new connector in `src/connectors/` that implements the `DataSourceConnector` interface
2. Add the connector to the stream processor in `src/pipeline/StreamProcessor.ts`
3. Update the feature engineering to incorporate the new data type
4. Retrain the model to include the new features

### Adding a New ML Model

1. Define the model architecture in `src/ml/models.ts`
2. Implement training logic in `src/ml/trainModel.ts`
3. Update the consensus prediction logic in `src/services/PredictionService.ts`

## API Documentation

The service exposes the following endpoints:

- `GET /api/predictions`: Get current surge predictions
- `GET /api/predictions/:locationId`: Get predictions for a specific location
- `POST /api/feedback`: Submit feedback on prediction accuracy

### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "h3Index": "89283082837ffff",
  "locationId": "37.774929,-122.419416",
  "timestamp": "2023-04-01T12:34:56Z",
  "surgeMultiplier": 1.8,
  "confidence": 0.85,
  "predictedDuration": 15,
  "factors": [
    {
      "name": "Weather Impact",
      "description": "Heavy rain in the area",
      "impact": 0.4
    },
    {
      "name": "Event Proximity",
      "description": "Concert ending in 15 minutes",
      "impact": 0.3
    }
  ]
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
