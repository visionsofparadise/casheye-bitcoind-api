import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { confirm } from './confirm';
import { txDetected } from './txDetected';
import { watchAddress } from './watchAddress';
import { isProd, logger } from './helpers';

export const getApis = (btc: any) => {
	const api = express();

	api.use(cors());
	api.use(bodyParser.urlencoded({ extended: true }));
	api.use(bodyParser.json());

	api.use((req, res, next) => {
		try {
			const { body, headers } = req
			logger.info({ body, headers })

			return next()
		} catch (err) {
			logger.error(err)
		
			return res.sendStatus(500)
		}
	})
	
	const internalApi = api
	const externalApi = api
	
	internalApi.get('/wallet-notify/:txId', async (req, res) => {
		const { txId } = req.params;
	
		await txDetected(txId, btc);
	
		return res.sendStatus(204);
	});
	
	internalApi.get('/block-notify/:blockHash', async (_, res) => {
		await confirm(btc);
	
		return res.sendStatus(204);
	});

	externalApi.get('/', async (_, res) => res.sendStatus(200));
	
	externalApi.use((req, res, next) => {
		if (req.headers.authorization !== process.env.SECRET) return res.sendStatus(401)

		return next()
	})
	
	externalApi.post('/address', async (req, res) => {
		const { address, duration } = req.body;
	
		await watchAddress(address, duration, btc);
	
		return res.sendStatus(204);
	});
	
	!isProd && externalApi.post('/rpc', async (req, res) => {	
		const { command, args } = req.body as { command: string; args?: Array<any> };

		const argsArray = args || [] 

		const result = await btc.rpc[command](...argsArray)

		return result ? res.status(200).send(result) : res.sendStatus(204)
	})

	return {
		externalApi,
		internalApi
	}
}


