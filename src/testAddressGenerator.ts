import { logger } from "./helpers";
import { HDPublicKey, Address, Networks } from 'bitcore-lib'

export const testAddressGenerator = () => {
	const xPubKeyObj = new HDPublicKey(process.env.TEST_XPUBKEY!);

	const number = Math.floor((Math.random() * 1000 * 1000) + 1);

	const derivedxPubKey = xPubKeyObj.deriveChild(`m/0/${number}`);

	const addressObj = new Address(derivedxPubKey.publicKey, Networks.testnet);

	const address = addressObj.toString()

	logger.info({ address });

	return address
}