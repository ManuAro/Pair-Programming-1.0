import pino from 'pino';

/**
 * Structured Logger using Pino
 *
 * Provides JSON-structured logging for better observability.
 * In production, logs are JSON for parsing by log aggregators (Datadog, CloudWatch, etc.)
 * In development, pretty-printed for easier reading.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

/**
 * Express middleware for request logging
 */
export function requestLogger(req: any, res: any, next: any) {
  const startTime = Date.now();

  // Log request
  logger.info({
    req,
    event: 'request_start',
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      req,
      res,
      duration,
      event: 'request_complete',
    });
  });

  next();
}
