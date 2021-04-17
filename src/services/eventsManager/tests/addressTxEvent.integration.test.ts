import kuuid from 'kuuid'
import axios from "axios"
import { encode } from '../../../services/webhookManager/webhookEncoder'
import { wait } from '../../../helpers'
import { testAddressGenerator } from '../../../testAddressGenerator'

it('triggers addressTx event', async () => {
	jest.useRealTimers()
	expect.assertions(5)

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		address: testAddressGenerator(),
		currency: 'BTC' as 'BTC',
		confirmations: 6,
		event: 'anyTx',
		url: process.env.TEST_URL!,
		node: 0
	}

	const redisPut = await axios.post(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: [webhook.address, webhook.id, encode(webhook)]
	})

	expect(redisPut.status).toBe(200)

	const bitcoinPut = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'importAddress',
		args: [webhook.address, 'set', false]
	})

	expect(bitcoinPut.status).toBe(200)

	const sendToAddress = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'sendToAddress',
		args: [webhook.address, 1]
	})

	expect(sendToAddress.status).toBe(200)

	await wait(10 * 1000)

	const redisResponse = await axios.post<string[]>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hvals',
		args: ['testData']
	})

	expect(redisResponse.status).toBe(200)
	
	const testData = redisResponse.data
		.map(data => JSON.parse(data) as { vout: Array<{ scriptPubKey: { addresses: string [] }}>})
		.filter(data => 
				data.vout && 
				data.vout[0] && 
				data.vout[0].scriptPubKey && 
				data.vout[0].scriptPubKey.addresses && 
				data.vout[0].scriptPubKey.addresses.includes(webhook.address))

	expect(testData.length).toBe(1)
}, 60 * 1000)