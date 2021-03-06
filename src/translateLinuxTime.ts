export const translateLinuxTime = (linuxDate: string) => {
	const timeSplit = linuxDate.split(',')
	const nanoSecondsSplit = timeSplit[1].split('+')
	const milliseconds = Math.round(parseInt(nanoSecondsSplit[0]) / (1000 * 1000))
	const iso8601Time = `${timeSplit[0]}.${milliseconds.toString().padStart(3, '0')}+${nanoSecondsSplit[1]}`

	return new Date(iso8601Time).valueOf()
}