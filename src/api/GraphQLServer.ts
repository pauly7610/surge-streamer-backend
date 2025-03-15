import { ApolloServer } from 'apollo-server-express';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub } from 'graphql-subscriptions';
import typeDefs from './schema';
import resolvers from './resolvers';
import { LocationService } from '../services/LocationService';
import { PredictionService } from '../services/PredictionService';
import { PipelineManager } from '../pipeline/PipelineManager';
import { Logger } from '../utils/Logger';
import config from '../config';

/**
 * GraphQL server for the Surge Streamer API
 */
export class GraphQLServer {
  private app: any;
  private httpServer: ReturnType<typeof createServer>;
  private apolloServer: ApolloServer;
  private subscriptionServer: SubscriptionServer | null = null;
  private pubsub: PubSub;
  private logger: Logger;
  private services: {
    locationService: LocationService;
    predictionService: PredictionService;
    pipelineManager: PipelineManager;
  };

  /**
   * Initialize the GraphQL server
   * @param config Server configuration
   */
  constructor(
    private serverConfig: typeof config,
    locationService: LocationService,
    predictionService: PredictionService,
    pipelineManager: PipelineManager
  ) {
    this.logger = new Logger('GraphQLServer');
    this.pubsub = new PubSub();
    this.app = express();
    this.httpServer = createServer(this.app);
    
    // Store services
    this.services = {
      locationService,
      predictionService,
      pipelineManager,
    };
    
    // Create schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    
    // Create Apollo Server
    this.apolloServer = new ApolloServer({
      schema,
      context: ({ req }) => ({
        services: this.services,
        pubsub: this.pubsub,
      }),
      introspection: this.serverConfig.graphql.introspection,
    });
    
    // Create subscription server
    this.subscriptionServer = SubscriptionServer.create(
      {
        schema,
        execute,
        subscribe,
        onConnect: () => ({
          services: this.services,
          pubsub: this.pubsub,
        }),
      },
      {
        server: this.httpServer,
        path: this.serverConfig.graphql.subscriptionsPath,
      }
    );
  }

  /**
   * Start the GraphQL server
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting GraphQL server...');
      
      // Apply middleware
      await this.apolloServer.start();
      this.apolloServer.applyMiddleware({
        app: this.app,
        path: this.serverConfig.graphql.path,
      });
      
      // Start HTTP server
      const port = this.serverConfig.server.port;
      const host = this.serverConfig.server.host;
      
      await new Promise<void>((resolve) => {
        this.httpServer.listen({ port, host }, resolve);
      });
      
      this.logger.info(`GraphQL server running at http://${host}:${port}${this.apolloServer.graphqlPath}`);
      this.logger.info(`GraphQL subscriptions available at ws://${host}:${port}${this.serverConfig.graphql.subscriptionsPath}`);
    } catch (error) {
      this.logger.error('Failed to start GraphQL server:', error);
      throw error;
    }
  }

  /**
   * Stop the GraphQL server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping GraphQL server...');
      
      // Stop subscription server
      if (this.subscriptionServer) {
        this.subscriptionServer.close();
      }
      
      // Stop Apollo server
      await this.apolloServer.stop();
      
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close((err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      this.logger.info('GraphQL server stopped');
    } catch (error) {
      this.logger.error('Failed to stop GraphQL server:', error);
      throw error;
    }
  }

  /**
   * Publish an event to a subscription topic
   * @param topic Topic to publish to
   * @param payload Event payload
   */
  publish(topic: string, payload: any): void {
    this.pubsub.publish(topic, payload);
  }
} 