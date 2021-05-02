import express, { Response } from 'express';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

const api = express();

api.post('/new-tx/:txid/:timestamp', async (req, res, next) => {	
	const { txid, timestamp } = req.params
	
	const dedupKey = `dedup-${txid}`
	const data = await redis.multi()
		.get(dedupKey)
		.set(dedupKey, '1', 'EX', 30 * 60)
		.exec()

	const result = data[0][1]

	res.sendStatus(204)

	if (!result) {	
		await addressTxEvent(txid, timestamp).catch(next)
		await cloudLog(`new transaction: ${txid}`)
	}
})

api.post('/new-block/:blockhash/:timestamp', async (req, res, next) => {	
	const { blockhash, timestamp } = req.params

	res.sendStatus(204)

	const newBlockPromise = newBlockEvent(blockhash, timestamp).catch(next)
	const confirmationsPromise = confirmationsEvent(blockhash, timestamp).catch(next)
	
	await Promise.all([newBlockPromise, confirmationsPromise]).catch(next)
	await cloudLog(`new block: ${blockhash}`)
})	

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog({ error })
	await cloudMetric('errors', [1])

	!res.writableEnded && res.sendStatus(204)
})

export { api }


