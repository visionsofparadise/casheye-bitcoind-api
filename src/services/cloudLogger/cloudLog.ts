import { logger } from '../../helpers'
import { redis } from '../../redis'

export const cloudLog = async (message: any) => {
	const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);

	const log = {
		timestamp: new Date().getTime(),
		message: formattedMessage
	}

	await redis.lpush('logs', JSON.stringify(log))

	logger.info(formattedMessage)
}

export const cloudError = async (message: any) => cloudLog({ error: message, stack: new Error().stack })