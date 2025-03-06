
import Client, {
    CommitmentLevel,
    SubscribeRequest,
    SubscribeUpdate,
} from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from '@grpc/grpc-js';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { BUY_AMOUNT, GRPC_ENDPOINT, GRPC_TOKEN, PRIVATE_KEY, RPC_ENDPOINT } from "./constants";
import { saveToJSONFile } from "./utils";
import { fetchPoolOnMeteoraDYN, swapOnMeteora, swapOnMeteoraDYN } from "./utils/meteoraSwap";
import { BN } from "bn.js";

dotenv.config()

const solanaConnection = new Connection(RPC_ENDPOINT, 'processed');
const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));

const METEORA_DLMM_PROGRAM_ID = new PublicKey(
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
);
const METEORA_AMM_PROGRAM_ID = new PublicKey(
    "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
);
// const METEORA_VAULT_PROGRAM_ID = new PublicKey(
//     "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi",
// );

// Main function
async function main(): Promise<void> {
    const client = new Client(GRPC_ENDPOINT, GRPC_TOKEN, undefined);
    const stream = await client.subscribe();
    const request = createSubscribeRequest();

    try {
        await sendSubscribeRequest(stream, request);
        console.log('Geyser connection established - watching new Meteora Pools. \n');
        await handleStreamEvents(stream);
    } catch (error) {
        console.error('Error in subscription process:', error);
        stream.end();
    }
}

// Helper functions
function createSubscribeRequest(): SubscribeRequest {
    return {
        accounts: {},
        slots: {},
        transactions: {
            meteora: {
                vote: false,
                failed: false,
                signature: undefined,
                accountInclude: [
                    METEORA_DLMM_PROGRAM_ID.toBase58(),
                    METEORA_AMM_PROGRAM_ID.toBase58(),
                ],
                accountExclude: [],
                accountRequired: [],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        ping: undefined,
        commitment: CommitmentLevel.PROCESSED,
    };
}


function sendSubscribeRequest(
    stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>,
    request: SubscribeRequest
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.write(request, (err: Error | null) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function handleStreamEvents(stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.on('data', async (data) => {
            // timestamp1 = Date.now();
            await handleData(data)
            // if (result) {
            //     stream.end();
            //     process.exit(1)
            // }
        });
        stream.on("error", (error: Error) => {
            console.error('Stream error:', error);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            console.log('Stream ended');
            resolve();
        });
        stream.on("close", () => {
            console.log('Stream closed');
            resolve();
        });
    });
}

async function handleData(data: SubscribeUpdate) {
    if (data.transaction) {
        const transaction = data.transaction;
        const logMessages = transaction.transaction?.meta?.logMessages;

        const isCreateLiquidity = logMessages?.filter((item) => {
            if (item.indexOf('Instruction: InitializeLbPair') > -1) {
                return true
            }
        })
        if (isCreateLiquidity && isCreateLiquidity?.length > 0) {
            const postBalances = transaction.transaction?.meta?.postTokenBalances;

            if (!postBalances || postBalances?.length === 0) return
            const poolId = postBalances[0].owner

            const tx = convertData(transaction.transaction?.signature!);
            console.log(`https://solscan.io/tx/${tx}`);
            console.log("Found new DLMM pool! Pool Id : ", `https://app.meteora.ag/dlmm/${poolId}`);
            const sig = await tryBuyUntilSuccess(poolId);
            console.log("Buy Success: ", sig);
            return
        }

        const isVault = logMessages?.filter((item) => {
            if (item.indexOf('Instruction: InitializeMint2') > -1) {
                return true
            }
        })
        
        // Some parts are missing (Contact: https://t.me/Takhi777)

    }
}

const tryBuyUntilSuccess = async (poolId: string): Promise<string> => {
    return new Promise((resolve) => {
        const monitor = setInterval(async () => {
            const sig = await swapOnMeteora(solanaConnection, keypair, BUY_AMOUNT, false, poolId);
            if (sig) {
                clearInterval(monitor);
                resolve(`https://solscan.io/tx/${sig}`)
            } else if (sig !== null) {
                clearInterval(monitor);
                resolve('Token A is not wsol!')
            }
        }, 2000);
    })
}

function convertData(data: Uint8Array): string {
    return bs58.encode(Buffer.from(data));
}

main().catch((err) => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
});