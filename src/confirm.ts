import upick from 'upick';
import { eventHelper, logger } from './helpers';

type ListTransactionsResponse = Array<{
	txid: string;
	address: string;
	confirmations: number;
}>;

export const confirm = async (btc: any) => {
	const page = async (pageNumber: number) => {
		const txs = (await btc.rpc.listTransactions('confirming', 100, pageNumber * 100, true)) as ListTransactionsResponse;

		logger.info({ txs })

		await Promise.all(
			txs.map(async tx => {
				const txPruned = upick(tx, ['txid', 'address', 'confirmations']);

				if (tx.confirmations > 6) {
					await btc.rpc.setLabel(tx.address, 'used');

					await eventHelper.send({
						DetailType: 'btcAddressUsed',
						Detail: txPruned
					});

					return;
				}

				await eventHelper.send({
					DetailType: 'btcConfirmation',
					Detail: txPruned
				});

				return;
			})
		);

		if (txs.length >= 100) await page(pageNumber + 1);

		return;
	};

	await page(0);
};
