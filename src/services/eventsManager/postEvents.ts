import axios from "axios";
import md5 from "md5";
import { sqs } from "../../sqs";
import { IWebhook } from "../../types/IWebhook";
import { apiGatewaySockets } from '../../apiGatewaySockets'
import { cloudLog } from "../cloudLogger/cloudLog";
import { cloudMetric } from "../cloudLogger/cloudMetric";
import day from "dayjs";
import { translateLinuxTime } from "../../translateLinuxTime";

export const postEvents = async (events: Array<{ webhook: Omit<IWebhook, 'currency'>; payload: any }>, callerName: string) => {
	const lowPriorityPromises: Promise<any>[] = []
	const errors: any[] = []

	await Promise.all(events.map(async event => {
		const { webhook, payload } = event

		const data = {
			...payload,
			casheye: {
				...payload.casheye,
				requestSendTime: day().valueOf()
			}
		}

		try {
			if (webhook.url) {
				const response = await axios.post(webhook.url, data)
	
				if (response.status > 299) throw new Error()
			}
	
			if (webhook.connectionId) {
				await apiGatewaySockets
					.postToConnection({
						ConnectionId: webhook.connectionId,
						Data: JSON.stringify(data)
					})
					.promise();
			}

			const now = day().valueOf()
			const requestStartTime = translateLinuxTime(payload.requestStartTime)
			const processingTime = now - requestStartTime

			const metricPromise = cloudMetric('processingTime', [processingTime], [{
				name: 'processor',
				value: callerName
			}])
			const logPromise = cloudLog({ callerName, processingTime })

			lowPriorityPromises.concat([metricPromise, logPromise])
		} catch (error) {
			lowPriorityPromises.push(cloudLog({ error }))
	
			const retry = {
				id: webhook.id,
				userId: webhook.userId,
				url: webhook.url,
				connectionId: webhook.connectionId,
				retries: 0,
				payload
			}
		
			const hash = md5(JSON.stringify(retry))

			errors.push({
				status: 'error',
				retry,
				hash
			})
		}
	}))

	lowPriorityPromises.concat([cloudLog({ events }), cloudMetric('events', [events.length - errors.length])])

	if (errors.length > 0) {
		lowPriorityPromises.concat([cloudLog({ errors }), cloudMetric('errors', [errors.length])])

		await sqs
			.sendMessageBatch({
				QueueUrl: process.env.ERROR_QUEUE_URL || 'test',
				Entries: errors.map(({ hash, retry }) => ({
					Id: hash!,
					MessageBody: JSON.stringify(retry!)
				}))
			})
			.promise();
	}

	await Promise.all<any>(lowPriorityPromises)
}