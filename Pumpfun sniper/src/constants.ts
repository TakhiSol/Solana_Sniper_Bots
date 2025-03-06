import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { logger, retrieveEnvVariable } from '../utility/index'

export const CHECK_FILTER = retrieveEnvVariable('CHECK_FILTER', logger) === 'true';
export const CHECK_SOCIAL = retrieveEnvVariable('CHECK_SOCIAL', logger) === 'true';
export const CHECK_NAMEWHITELIST = retrieveEnvVariable('CHECK_NAMEWHITELIST', logger) === 'true';
export const CHECK_NAMEBLACKLIST = retrieveEnvVariable('CHECK_NAMEBLACKLIST', logger) === 'true';
export const CHECK_WALLETWHITELIST = retrieveEnvVariable('CHECK_WALLETWHITELIST', logger) === 'true';
export const CHECK_WALLETBLACKLIST = retrieveEnvVariable('CHECK_WALLETBLACKLIST', logger) === 'true';
export const CHECK_SOLDBALANCE = retrieveEnvVariable('CHECK_SOLDBALANCE', logger) === 'true';
export const USE_SNIPE_LIST = retrieveEnvVariable('USE_SNIPE_LIST', logger) === 'true'

export const COMMITMENT_LEVEL: Commitment = retrieveEnvVariable('COMMITMENT_LEVEL', logger) as Commitment

export const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger)
export const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable('RPC_WEBSOCKET_ENDPOINT', logger)

export const JITO_MODE = retrieveEnvVariable('JITO_MODE', logger) === 'true'
// export const JITO_ALL = retrieveEnvVariable('JITO_ALL', logger) === 'true'
export const BLOCKENGINE_URL = retrieveEnvVariable('BLOCKENGINE_URL', logger)
export const JITO_AUTH_KEYPAIR = retrieveEnvVariable('JITO_KEY', logger)
export const JITO_FEE = Number(retrieveEnvVariable('JITO_FEE', logger)) * 10 ** 9

export const PAYER_PRIVATEKEY = retrieveEnvVariable('PAYERPRIVATEKEY', logger)

export const GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
export const FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
export const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOC_TOKEN_ACC_PROG = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const RENT = new PublicKey("SysvarRent111111111111111111111111111111111");
export const PUMP_FUN_ACCOUNT = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
export const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const SOL = "So11111111111111111111111111111111111111112";

export const MINIMUMTOKENBALANCEPERCENT = 10;