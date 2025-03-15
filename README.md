# Surge Streamer Backend

A real-time data streaming system for Uber Surge Prediction, processing ride requests and driver locations to generate surge pricing predictions.

## Architecture

The Surge Streamer Backend is built on a modern streaming architecture with the following components:

### Core Components

- **Data Source Connectors**: Connect to external data sources (ride requests, driver locations, weather, traffic, events)
- **Stream Processing Pipeline**: Process and transform data streams using RxJS
- **Kafka Integration**: Message streaming and event sourcing
- **Geospatial Processing**: H3 hexagonal grid system for geospatial indexing and analysis
- **ML Prediction**: TensorFlow.js-based prediction model for surge pricing

### Implemented Components

- ✅ **DataSourceConnector Interface**: Generic interface for all data source connectors
- ✅ **RideRequestConnector**: Connector for ride request data
- ✅ **DriverLocationConnector**: WebSocket-based connector for driver location data
- ✅ **StreamProcessor**: RxJS-based pipeline for processing data streams
- ✅ **PipelineManager**: Coordinates data flow between connectors and processors
- ✅ **KafkaService**: Service for Kafka message production and consumption
- ✅ **GeospatialUtils**: H3-based utilities for geospatial operations
- ✅ **Avro Schemas**: Schema definitions for Kafka message serialization
- ✅ **Data Models**: TypeScript interfaces for all data types

### Data Flow

1. Data sources emit events to connectors
2. Connectors transform raw data into standardized events
3. Stream processors enrich and process events
4. Processed data is sent to Kafka topics
5. Prediction service generates surge predictions
6. API serves predictions to clients

## Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Kafka (optional, for production)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/surge-streamer-backend.git
cd surge-streamer-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.development
```

### Configuration

Edit the `.env.development` file with your configuration:

```
NODE_ENV=development
PORT=3000
HOST=localhost

# Supabase (if using)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Kafka (if using)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=surge-streamer
KAFKA_CONSUMER_GROUP=surge-streamer-group

# Geospatial
DEFAULT_H3_RESOLUTION=8
DEFAULT_BOUNDING_BOX_RADIUS_KM=5
```

### Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

- `GET /health`: Health check endpoint
- `GET /api/status`: Get pipeline status
- `POST /api/pipeline/start`: Start the data pipeline
- `POST /api/pipeline/stop`: Stop the data pipeline

## Project Structure

```
src/
├── connectors/       # Data source connectors
│   ├── DataSourceConnector.ts  # Base interface
│   ├── RideRequestConnector.ts # Ride request connector
│   └── DriverLocationConnector.ts # Driver location connector
├── pipeline/         # Stream processing pipeline
│   ├── StreamProcessor.ts      # RxJS-based processor
│   └── PipelineManager.ts      # Pipeline coordination
├── schemas/          # Data schemas
│   ├── DataModels.ts           # TypeScript interfaces
│   └── AvroSchemas.ts          # Avro schemas for Kafka
├── utils/            # Utility functions
│   ├── AvroUtils.ts            # Avro serialization utilities
│   ├── GeospatialUtils.ts      # H3 geospatial utilities
│   └── KafkaService.ts         # Kafka integration
├── config.ts         # Configuration
└── index.ts          # Application entry point
```

## Development

### Adding a New Data Source

1. Create a connector in `src/connectors/` that implements the `DataSourceConnector` interface
2. Add the connector to the `PipelineManager` in `initializeConnectors()`
3. Create a processor for the data source in `initializeProcessors()`
4. Set up the subscription in `setupSubscriptions()`

### Adding a Processing Stage

1. Create a processor function that takes input data and returns processed data
2. Add it to the appropriate `StreamProcessor` instance using `addStage()`

## Next Steps

- Implement additional data source connectors (Weather, Traffic, Events)
- Develop the ML prediction model using TensorFlow.js
- Add data persistence layer for historical analysis
- Implement real-time visualization API endpoints
- Set up monitoring and alerting for the pipeline

## License

MIT
