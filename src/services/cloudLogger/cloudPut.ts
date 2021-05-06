import { metrics } from "./metrics";
import { cloudwatch, cloudwatchLogs } from '../../cloudwatch'
import { wait } from '../../helpers'
import { redis } from '../../redis'
import { cloudError, cloudLog } from './cloudLog'
import { cloudMetric } from './cloudMetric'

export const cloudPut = async (): Promise<any> => {
	await cloudLog('cloud logger started')

	const namespace = `casheye/node/${process.env.STAGE!}/${process.env.NETWORK!}/${process.env.NODE_INDEX!}`
	
	while (true) {
		try {
			const info = await redis.info('memory')
			const memoryUsage = info.split("\r\n")[1]

			await cloudMetric('ramUsage', [parseInt(memoryUsage)])

			const now = new Date().getTime()
			const logDataResult = await redis.multi()
				.lrange('logs', 0, -1)
				.del('logs')
				.exec()
			const logData = logDataResult[0][1] as string[]
			
			if (logData.length > 0) {
				const logEvents = logData
					.map(logData => JSON.parse(logData))
					.sort((logA, logB) => logA.timestamp - logB.timestamp)
	
				const logStreamName = namespace + `/${now}`
	
				await cloudwatchLogs.createLogStream({
					logGroupName: process.env.LOG_GROUP_NAME!,
					logStreamName
				}).promise()
				
				await cloudwatchLogs.putLogEvents({
					logGroupName: process.env.LOG_GROUP_NAME!,
					logStreamName,
					logEvents
				}).promise()
			}
	
			for (const metric of metrics) {
				const meticKey = `metric-${metric}`
				const metricDataResult = await redis.multi()
					.lrange(meticKey, 0, -1)	
					.del(meticKey)
					.exec()
				const metricData = metricDataResult[0][1] as string[]
	
				if (metricData.length > 0) {
					const metrics = metricData
						.map(metricData => JSON.parse(metricData))
						.sort((metricA, metricB) => metricA.timestamp - metricB.timestamp)
	
					await cloudwatch.putMetricData({
						Namespace: namespace,
						MetricData: metrics.map(({ values, dimensions, timestamp }) => ({
								MetricName: metric,
								Values: values,
								Timestamp: new Date(timestamp).toISOString() as any,
								Dimensions: dimensions && dimensions.map((d: { name: string; value: string }) => ({
									Name: d.name,
									Value: d.value
								}))
						})),
	
					}).promise()
				}
			}
		} catch (error) {
			await cloudError(error)
		}

		await wait(60 * 1000)
	}
}