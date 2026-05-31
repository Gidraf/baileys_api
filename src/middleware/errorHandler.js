import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, next) {
  logger.error({ err, path: req.path, method: req.method }, 'Request error')

  const status = err.output?.statusCode || err.status || 500
  const message = err.message || 'Internal server error'

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  })
}
