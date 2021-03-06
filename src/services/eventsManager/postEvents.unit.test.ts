import axios from "axios"
import { apiGatewaySockets } from "../../apiGatewaySockets"
import { sqs } from "../../sqs"
import { IWebhook } from "../../types/IWebhook"
import { postEvents } from "./postEvents"

jest.mock('ioredis', () => require('ioredis-mock/jest'));
jest.mock('axios', () => ({
	post: jest.fn()
		.mockResolvedValueOnce({
			status: 200
		})
		.mockRejectedValueOnce({
			status: 500
		})
}))
jest.mock('../../apiGatewaySockets', () => ({
	apiGatewaySockets: {
		postToConnection: jest.fn()
		.mockReturnValue({
			promise: jest.fn()
				.mockResolvedValueOnce('success')
				.mockRejectedValueOnce('error')
		})
	}
}))
jest.mock('../../sqs', () => ({
	sqs: {
		sendMessageBatch: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	}
}))
jest.mock('../cloudLogger/cloudLog')
jest.mock('../cloudLogger/cloudMetric')

const linuxTime = () => new Date(new Date().getTime()).toISOString().split('.')[0] + ',100000000+00:00'

it('posts a payload to a url', async () => {
	jest.clearAllMocks()

	const events = [
		{
			webhook: {
				url: 'test'
			} as IWebhook,
			payload: {
				requestStartTime: linuxTime()
			}
		}
	]

	await postEvents(events)

	expect(axios.post).toBeCalledTimes(1)
	expect(apiGatewaySockets.postToConnection).toBeCalledTimes(0)
	expect(sqs.sendMessageBatch).toBeCalledTimes(0)
})

it('posts a payload to a connectionId', async () => {
	jest.clearAllMocks()

	const events = [
		{
			webhook: {
				connectionId: 'test'
			} as IWebhook,
			payload: {
				requestStartTime: linuxTime()
			}
		}
	]

	await postEvents(events)

	expect(axios.post).toBeCalledTimes(0)
	expect(apiGatewaySockets.postToConnection).toBeCalledTimes(1)
	expect(sqs.sendMessageBatch).toBeCalledTimes(0)
})

it('adds error axios post to error queue', async () => {
	jest.clearAllMocks()

	const events = [
		{
			webhook: {
				id: 'test',
				userId: 'test',
				url: 'test'
			} as IWebhook,
			payload: {
				requestStartTime: linuxTime()
			}
		}
	]

	await postEvents(events)

	expect(axios.post).toBeCalledTimes(1)
	expect(apiGatewaySockets.postToConnection).toBeCalledTimes(0)
	expect(sqs.sendMessageBatch).toBeCalledTimes(1)
})

it('adds error apiGatewaySocket post to error queue', async () => {
	jest.clearAllMocks()

	const events = [
		{
			webhook: {
				id: 'test',
				userId: 'test',
				connectionId: 'test'
			} as IWebhook,
			payload: {
				requestStartTime: linuxTime()
			}
		}
	]

	await postEvents(events)

	expect(axios.post).toBeCalledTimes(0)
	expect(apiGatewaySockets.postToConnection).toBeCalledTimes(1)
	expect(sqs.sendMessageBatch).toBeCalledTimes(1)
})