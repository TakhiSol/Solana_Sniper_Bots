import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import base58 from 'bs58';
import { PAYER_PRIVATEKEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "./constants"

export const payerPrivateKey = PAYER_PRIVATEKEY
export const payerKeypair = Keypair.fromSecretKey(base58.decode(payerPrivateKey));
export const connection = new Connection(RPC_ENDPOINT, { wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "processed" });
export const feePayer = new PublicKey("CRaSpicJ7fQxnyV9WHLZH46wXGihXmzN5JFbiVQuEtB")

export const blockengingUrl = "tokyo.mainnet.block-engine.jito.wtf"
export const jitoFee = 1_000_000            // 0.01SOL
export const jitoKeyStr = "66xqL9aFZJ8k9YpjNBexNASfuoDgNE1ZpGRXB28zoTfS4u2czzVBhMNMqgZYFeMN8FnUi6gMzXWgVYRHkTZ6yuLC"

export const commitment="finalized"