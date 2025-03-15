# Surge Streamer Data Pipeline

This directory contains the implementation of the real-time data streaming system for the Surge Streamer backend. The system processes data from various sources to generate surge pricing predictions.

## Architecture Overview

The data pipeline follows a stream processing architecture with the following components:

1. **Data Source Connectors**: Interfaces with external data sources
2. **Data Stream Pipeline**: Manages the flow of real-time data
3. **Data Processing Engine**: Processes and transforms incoming data
4. **Prediction & Storage Layer**: Applies prediction algorithms and stores results in Supabase

## Key Components

### Data Source Connectors

The system includes connectors for various data sources:

- `RideRequestConnector`: Fetches ride request data from Supabase
- `DriverLocationConnector`: Fetches driver location data from Supabase
- Additional connectors can be added for weather, traffic, events, etc.

### Data Stream Pipeline

The `DataStreamPipeline` class orchestrates the flow of data through the system:

- Combines streams from multiple data sources
- Routes events to the appropriate processors
- Manages the lifecycle of connectors and the processing engine

### Data Processing Engine

The `DataProcessingEngine` class processes the incoming data:

- Converts geographic coordinates to hexagonal grid cells
- Aggregates data by time windows and geographic areas
- Calculates supply/demand ratios and other metrics
- Generates surge predictions based on multiple factors

### Geospatial Utilities

The `geospatial.ts` module provides utilities for working with geographic data:

- Converts latitude/longitude to hexagonal grid cells
- Calculates distances between points
- Finds neighboring cells in the hexagonal grid

### Prediction Service

The `prediction.ts` module provides APIs for accessing surge predictions:

- `getSurgePrediction`: Get surge prediction for a specific location and time
- `getSurgeTimeline`: Get a timeline of surge predictions for a location
- `getHeatmapData`: Get heatmap data for a geographic area

## Running the Pipeline

To start the data pipeline:

```bash
# Build the TypeScript code
npm run build

# Start the pipeline
npm run start:pipeline
```

The pipeline will connect to Supabase and begin processing data from the configured sources.

## Adding New Data Sources

To add a new data source:

1. Create a new connector class that implements the `DataSourceConnector` interface
2. Add the connector to the pipeline in `createDataPipeline()`
3. Add processing logic for the new data type in `DataProcessingEngine`

## Configuration

The pipeline uses the following environment variables:

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_KEY`: The API key for your Supabase project

These should be set in your environment before starting the pipeline.
