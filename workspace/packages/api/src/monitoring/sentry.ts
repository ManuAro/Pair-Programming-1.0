import * as Sentry from '@sentry/node';
import { Express } from 'express';
import { logger } from '../utils/logger';

/**
 * Sentry Error Monitoring Setup
 *
 * Tracks errors, performance, and provides alerting.
 * To enable: Set SENTRY_DSN environment variable
 */

export function initializeSentry(app: Express): void {
  const sentryDSN = process.env.SENTRY_DSN;

  if (!sentryDSN) {
    logger.warn('SENTRY_DSN not set - error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // Sample 10% in prod, 100% in dev
    integrations: [
      // HTTP integration for Express
      new Sentry.Integrations.Http({ tracing: true }),
      // Automatically instrument Express.js
      new Sentry.Integrations.Express({ app }),
    ],
    beforeSend(event, hint) {
      // Don't send validation errors to Sentry (too noisy)
      if (hint.originalException instanceof Error) {
        const error = hint.originalException as any;
        if (error.statusCode === 400 || error.code === 'VALIDATION_ERROR') {
          return null;
        }
      }
      return event;
    },
  });

  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  logger.info('Sentry error monitoring initialized');
}

/**
 * Sentry error handler
 *
 * Must be registered AFTER all routes but BEFORE other error handlers
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only report errors with status >= 500
      const statusCode = (error as any).statusCode || 500;
      return statusCode >= 500;
    },
  });
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
  logger.error({ err: error, context }, 'Exception captured by Sentry');
}

/**
 * Capture message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
  logger.info({ message, level }, 'Message captured by Sentry');
}
