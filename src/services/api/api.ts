import express, { Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isProd, logger } from '../../helpers';
import { rpc } from '../bitcoind/bitcoind'
import { resetWebhooks } from '../webhookManager/resetWebhooks';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';

const api = express();

api.use(cors());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(bodyParser.json());

api.get('/', async (_, res) => res.sendStatus(200));

api.post('/new-tx/:txid', async (req, res) => {	
	const { txid } = req.params

	addressTxEvent(txid)

	res.sendStatus(204)
})

api.post('/new-block/:blockhash', async (req, res) => {	
	const { blockhash } = req.params

	confirmationsEvent()
	newBlockEvent(blockhash)

	res.sendStatus(204)
})

!isProd && api.post('/rpc', async (req, res, next) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	await rpc[command](...argsArray)
		.then((result: any) => result ? res.status(200).send(result) : res.sendStatus(204))
		.catch(next)
})

!isProd && api.post('/redis', async (req, res, next) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	const redisCast = redis as any

	await redisCast[command](...argsArray)
		.then((result: any) => result ? res.status(200).send(result) : res.sendStatus(204))
		.catch(next)
})

!isProd && api.post('/reset', async (_, res, next) => {	
	await resetWebhooks().then(() => res.sendStatus(204)).catch(next)
})

!isProd && api.use((err: any, _: any, res: Response<any>, __: any) => {
	logger.error(err.stack)
	
  res.status(500).send(JSON.stringify(err))
})

export { api }


