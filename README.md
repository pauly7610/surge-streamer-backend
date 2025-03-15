# Surge Streamer Backend

A real-time data streaming system for Uber Surge Prediction.

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

6. **Storage Layer**: Persists data for analysis and model training

   - Time-series data storage
   - Historical data for model training

7. **GraphQL API**: Provides a flexible interface for clients
   - Real-time data subscriptions
   - Query capabilities for historical data

### Data Flow

1. Data source connectors collect data from various APIs
2. Raw data is sent to Kafka topics
3. Stream processor aggregates and enriches data
4. Aggregated data is processed by the ML prediction model
5. Predictions are stored and made available via the API
6. Clients consume real-time predictions and historical data

## Getting Started

### Prerequisites

- Node.js 16+
- Docker and Docker Compose
- Kafka
- MongoDB
- Redis

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/surge-streamer-backend.git
   cd surge-streamer-backend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:

   ```
   cp .env.example .env
   ```

   Edit the `.env` file with your configuration.

4. Start the required services using Docker Compose:

   ```
   docker-compose up -d
   ```

5. Build the project:
   ```
   npm run build
   ```

### Running the Application

Start the application in development mode:

```
npm run dev
```

For production:

```
npm run build
npm start
```

## Development

### Project Structure

```
src/
├── connectors/        # Data source connectors
├── pipeline/          # Stream processing pipeline
├── processing/        # Data processing utilities
├── prediction/        # ML prediction models
├── api/               # GraphQL API
├── models/            # Data models
├── schemas/           # Schema definitions
├── utils/             # Utility functions
├── config/            # Configuration
├── index.ts           # Application entry point
└── config.ts          # Configuration
```

### Adding a New Data Source

1. Create a new connector in `src/connectors/` that implements the `DataSourceConnector` interface
2. Add the connector to the stream processor in `src/index.ts`
3. Update the stream processor to handle the new data type

### Testing

Run tests:

```
npm test
```

Run tests with coverage:

```
npm run test:coverage
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
