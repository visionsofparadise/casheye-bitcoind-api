import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { IWebhook } from '../types/IWebhook'
import { eventbridge } from '../eventbridge'
import { documentClient } from '../dynamodb'

const addressTxWebhook = {
	id: kuuid.id(),
	userId: kuuid.id(),
	address: testAddressGenerator(),
	currency: 'BTC',
	confirmations: 6,
	event: 'addressTx',
	url: process.env.TEST_URL! + 'test'
}

const newBlockWebhook = {
	id: kuuid.id(),
	userId: kuuid.id(),
	currency: 'BTC',
	event: 'newBlock',
	url: process.env.TEST_URL! + 'test'
}

const webhooks = [addressTxWebhook, newBlockWebhook]

beforeAll(async (done) => {
	const redisOldTestData = await documentClient.query({
		TableName: process.env.DYNAMODB_TABLE!,
		KeyConditionExpression: 'pk = :pk',
		ExpressionAttributeValues: {
			':pk': 'BitcoinNodeTestData'
		}
	}).promise()

	if (redisOldTestData.Items) {
		for (const item of redisOldTestData.Items) {
			await documentClient.delete({
				TableName: process.env.DYNAMODB_TABLE!,
				Key: {
					pk: item.pk,
					sk: item.sk
				}
			}).promise()
		}
	}

	done()
})

it('tests webhooks with url', async () => {
	jest.useRealTimers()
	expect.assertions(15)

	await eventbridge.putEvents({
		Entries: webhooks.map(webhook => ({
			Source: 'casheye-' + process.env.STAGE!,
			DetailType: 'setWebhook',
			Detail: JSON.stringify(webhook)
		}))
	}).promise()

	await wait(10 * 1000)

	try {
		const redisGet1 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [addressTxWebhook.address, addressTxWebhook.id]
		})
	
		logger.info(redisGet1.data)
		expect(redisGet1.status).toBe(200)
		expect(redisGet1.data).toStrictEqual(omit(addressTxWebhook, ['currency']))
	
		const redisGet2 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet2.data)
		expect(redisGet2.status).toBe(200)
		expect(redisGet2.data).toStrictEqual(omit(newBlockWebhook, ['currency']))
	
		const bitcoinGet1 = await axios.post<{ iswatchonly: boolean; labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [addressTxWebhook.address]
		})
	
		logger.info(bitcoinGet1.data)
		expect(bitcoinGet1.status).toBe(200)
		expect(bitcoinGet1.data.iswatchonly).toBe(true)
		expect(bitcoinGet1.data.labels[0].name).toBe('set')
	
		const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'sendToAddress',
			args: [addressTxWebhook.address, "0.01"]
		})
	
		logger.info(bitcoinSend.data)
		expect(bitcoinSend.status).toBe(200)
	
		await wait(3 * 1000)
	
		for (let i = 0; i < 6; i++ ) {
			const generateResponse = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generateResponse.status)
		
			await wait(1000)
		}
	
		await wait(5 * 1000)
	
		const redisTestData = await documentClient.query({
			TableName: process.env.DYNAMODB_TABLE!,
			KeyConditionExpression: 'pk = :pk',
			ExpressionAttributeValues: {
				':pk': 'BitcoinNodeTestData'
			}
		}).promise()
	
		logger.info(redisTestData)
		expect(redisTestData.Items!.length).toBe(13)
	
		await eventbridge.putEvents({
			Entries: webhooks.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'unsetWebhook',
				Detail: JSON.stringify({
					...webhook,
					node: 0
				})
			}))
		}).promise()
	
		await wait(10 * 1000)
	
		const redisGet3 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [addressTxWebhook.address, addressTxWebhook.id]
		})
	
		logger.info(redisGet3.data)
		expect(redisGet3.status).toBe(204)
		expect(redisGet3.data).toBe("")
	
		const redisGet4 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet4.data)
		expect(redisGet4.status).toBe(204)
		expect(redisGet4.data).toBe("")
	
		const bitcoinGet2 = await axios.post<{ labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [addressTxWebhook.address]
		})
	
		logger.info(bitcoinGet2.data)
		expect(bitcoinGet2.status).toBe(200)
		expect(bitcoinGet2.data.labels[0].name).toBe('unset')
	} catch (error) {
		await eventbridge.putEvents({
			Entries: webhooks.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'unsetWebhook',
				Detail: JSON.stringify({
					...webhook,
					node: 0
				})
			}))
		}).promise()

		throw error
	}
}, 5 * 60 * 1000)
