import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PipelineManager } from './pipeline/PipelineManager';
import config from './config';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Create pipeline manager
const pipelineManager = new PipelineManager();

// Health check endpoint
app.get('/health', (req, res) => {
  const status = pipelineManager.getStatus();
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    pipeline: status
  });
});

// API routes
app.get('/api/status', (req, res) => {
  const status = pipelineManager.getStatus();
  res.json(status);
});

// Start the pipeline
app.post('/api/pipeline/start', async (req, res) => {
  try {
    await pipelineManager.start();
    res.json({ success: true, message: 'Pipeline started' });
  } catch (error) {
    console.error('Error starting pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to start pipeline', error: (error as Error).message });
  }
});

// Stop the pipeline
app.post('/api/pipeline/stop', async (req, res) => {
  try {
    await pipelineManager.stop();
    res.json({ success: true, message: 'Pipeline stopped' });
  } catch (error) {
    console.error('Error stopping pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to stop pipeline', error: (error as Error).message });
  }
});

// Start the server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Environment: ${config.env}`);
  
  // Auto-start pipeline in production
  if (config.isProd) {
    console.log('Auto-starting pipeline in production mode...');
    pipelineManager.start()
      .then(() => {
        console.log('Pipeline started successfully');
      })
      .catch((error) => {
        console.error('Failed to auto-start pipeline:', error);
      });
  } else {
    console.log('Pipeline not auto-started in development mode. Use /api/pipeline/start to start manually.');
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pipelineManager.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pipelineManager.stop();
  process.exit(0);
}); 