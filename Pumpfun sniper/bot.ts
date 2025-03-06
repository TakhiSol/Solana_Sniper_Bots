import {
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  LAMPORTS_PER_SOL,
  Connection,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  sendAndConfirmRawTransaction,
  TransactionExpiredBlockheightExceededError,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  closeAccount,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

import {
  commitment,
  feePayer
} from "./src/config";
import {
  bufferFromUInt64,
  createTransaction,
  generateDistribution,
  saveDataToFile,
  sendAndConfirmTransactionWrapper,
  sleep,
  logger
} from "./utility";
import {
  bundle,
  execute
} from "./executor";
import {
  BONDINGCURVECUSTOM,
  BONDING_CURV
} from "./layout/layout";
import {
  GLOBAL,
  FEE_RECIPIENT,
  SYSTEM_PROGRAM,
  TOKEN_PROGRAM,
  RENT,
  PUMP_FUN_ACCOUNT,
  PUMP_FUN_PROGRAM,
  CHECK_FILTER,
  JITO_MODE,
  ASSOC_TOKEN_ACC_PROG,
} from "./src/constants";

import { filterToken } from "./tokenFilter";
import fs from "fs"
import BN from "bn.js";
import base58 from "bs58";
import readline from "readline"
import { rl, snipe_menu } from ".";

const fileName = "./config.json"
const fileName2 = "./config_sniper.json"

let file_content = fs.readFileSync(fileName, 'utf-8');
let file_content2 = fs.readFileSync(fileName2, 'utf-8');
let content = JSON.parse(file_content);
let content2 = JSON.parse(file_content2);

const RPC_ENDPOINT = content.RPC_ENDPOINT;
const RPC_WEBSOCKET_ENDPOINT = content.RPC_WEBSOCKET_ENDPOINT;
const SLIPPAGE = content.Slippage;
const PAYERPRIVATEKEY = content.PAYERPRIVATEKEY;
const payerKeypair = Keypair.fromSecretKey(base58.decode(PAYERPRIVATEKEY));

const solIn = content2.solIn;
const txNum = content2.txNum;
const takeProfit = content2.takeProfit;
const stopLoss = content2.stopLoss;
const txDelay = content2.txDelay;
const txFee = content2.txFee;
const computeUnit = content2.computeUnit;

const connection = new Connection(RPC_ENDPOINT, { wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed" });

let virtualSolReserves: BN;
let virtualTokenReserves: BN;

const TRADE_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const BONDING_ADDR_SEED = new Uint8Array([98, 111, 110, 100, 105, 110, 103, 45, 99, 117, 114, 118, 101]);

let bonding: PublicKey;
let assoc_bonding_addr: PublicKey;

let isBuying = false;
let isBought = false;
let buyPrice: number;
let globalLogListener: number | null = null

export const runListener = () => {
  try {
    console.log("\nTracking new pools in pump.fun....");
    globalLogListener = connection.onLogs(
      PUMP_FUN_PROGRAM,
      async ({ logs, err, signature }) => {
        const isMint = logs.filter(log => log.includes("MintTo")).length;
        if (!isBuying && isMint && !isBought) {
          isBuying = true

          console.log("============== Found new token in the pump.fun: ==============")
          console.log("signature: ", signature);

          const parsedTransaction = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
          if (!parsedTransaction) {
            console.log("bad Transaction, signature: ", signature);
            isBuying = false
            return;
          }

          const wallet = parsedTransaction?.transaction.message.accountKeys[0].pubkey;
          const mint = parsedTransaction?.transaction.message.accountKeys[1].pubkey;
          const tokenPoolAta = parsedTransaction?.transaction.message.accountKeys[4].pubkey;
          // console.log("mint:", mint)
          // console.log("tokenPoolAta:", tokenPoolAta)
          // console.log("wallet:", wallet)
          console.log("🚀 ~ CHECK_FILTER:", CHECK_FILTER)

          // check token if the filtering condition is ok
          if (CHECK_FILTER) {

            // true if the filtering condition is ok, false if the filtering condition is false
            const buyable = await filterToken(connection, mint!, commitment, wallet!, tokenPoolAta!);

            console.log(buyable ? "🚀 ~ Token passed filter checks, so buying this." : "🚀 ~ Token didn't pass filter checks, so don't buy this token.")

            if (buyable) {

              await getPoolState(mint);

              console.log("========= Token Buy start ==========");

              try {
                connection.removeOnLogsListener(globalLogListener!)
                console.log("Global listener is removed!");
              } catch (err) {
                console.log(err);
              }

              // buy transaction
              await buy(payerKeypair, mint, solIn / 10 ** 9, 10);

              console.log("========= Token Buy end ===========");

              const buyerAta = await getAssociatedTokenAddress(mint, payerKeypair.publicKey)
              const balance = (await connection.getTokenAccountBalance(buyerAta)).value.amount
              // console.log("BuyerAtaBalance: ", balance);
              const priorityFeeInSol = txFee;     // SOL

              console.log("========== Token Sell start ===========");

              console.log(" = This is trial version so sell part is eliminated... Plz try the complete version to sell. = ")

              console.log("========== Token Sell end ==========");
            } else {
              connection.removeOnLogsListener(globalLogListener!)
              runListener()
            }
          } else {
            // true if the filtering condition is ok, false if the filtering condition is false
            connection.removeOnLogsListener(globalLogListener!)

            await getPoolState(mint);

            console.log("========= Token Buy start ==========");

            try {
              connection.removeOnLogsListener(globalLogListener!)
              console.log("Global listener is removed!");
            } catch (err) {
              console.log(err);
            }

            // buy transaction
            await buy(payerKeypair, mint, solIn / 10 ** 9, 10);

            console.log("========= Token Buy end ===========");

            const buyerAta = await getAssociatedTokenAddress(mint, payerKeypair.publicKey)
            const balance = (await connection.getTokenAccountBalance(buyerAta)).value.amount
            // console.log("BuyerAtaBalance: ", balance);
            const priorityFeeInSol = txFee;     // SOL

            console.log("========== Token Sell start ===========");

            console.log(" = This is trial version so sell part is eliminated... Plz try the complete version to sell. = ")

            console.log("========== Token Sell end ==========");

            rl.question("Press Enter to continue Sniping.", () => {
              // try {
              //   connection.removeOnLogsListener(globalLogListener!)
              //   console.log("Global listener is removed!");
              // } catch (err) {
              //   console.log(err);
              // }
              snipe_menu();
            })
          }
          isBuying = false
          // console.log("isBuying: ", isBuying);
          // if (isBought) process.exit(1);
        }
      },
      commitment
    );
  } catch (err) {
    console.log(err);
  }
};

export const buy = async (
  keypair: Keypair,
  mint: PublicKey,
  solIn: number,
  slippageDecimal: number = 0.01
) => {

  console.log("Payer wallet public key is", payerKeypair.publicKey.toBase58())
  const buyerKeypair = keypair
  const buyerWallet = buyerKeypair.publicKey;
  const tokenMint = mint
  let buyerAta = await getAssociatedTokenAddress(tokenMint, buyerWallet)

  try {
    const transactions: VersionedTransaction[] = []

    // console.log("🚀 ~ buyerAta:", buyerAta.toBase58())

    let ixs: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Math.floor(txFee * 10 ** 9 / computeUnit * 10 ** 6) }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnit })
    ];

    // Attempt to retrieve token account, otherwise create associated token account
    try {

      const buyerTokenAccountInfo = await connection.getAccountInfo(buyerAta)
      if (!buyerTokenAccountInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            buyerWallet,
            buyerAta,
            buyerWallet,
            tokenMint,
          )
        )
      }
    } catch (error) {
      console.log(error)
      return
    }

    const solInLamports = solIn * LAMPORTS_PER_SOL;
    console.log("🚀 ~ solInLamports:", solInLamports)
    const tokenOut = Math.round(solInLamports * (virtualTokenReserves.div(virtualSolReserves)).toNumber());
    console.log("🚀 ~ tokenOut:", tokenOut)

    // Calculate the buy price of the token
    buyPrice = (virtualTokenReserves.div(virtualSolReserves)).toNumber();

    const ATA_USER = buyerAta;
    const USER = buyerWallet;
    console.log("🚀 ~ buyerAta:", buyerAta.toBase58())
    console.log("🚀 ~ buyerWallet:", buyerWallet.toBase58())

    // Build account key list
    const keys = [
      { pubkey: GLOBAL, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: bonding, isSigner: false, isWritable: true },
      { pubkey: assoc_bonding_addr, isSigner: false, isWritable: true },
      { pubkey: ATA_USER, isSigner: false, isWritable: true },
      { pubkey: USER, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: RENT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false }
    ];

    // Confirming process of the account setting
    // keys.map(async ({ pubkey }, i) => {
    //   const info = await connection.getAccountInfo(pubkey)
    //   if (!info) console.log(pubkey.toBase58(), " address info : null : ", i)
    // })

    // Calculating the slippage process
    const calc_slippage_up = (sol_amount: number, slippage: number): number => {
      const lamports = sol_amount * LAMPORTS_PER_SOL;
      return Math.round(lamports * (1 + slippage));
      // return Math.round(lamports / 1000 * (1 + slippage) + lamports / 1000 * (1 + slippage));
      // return Math.round(lamports / 1000 * (1 + slippage / 100));
    }

    const instruction_buf = Buffer.from('66063d1201daebea', 'hex');
    const token_amount_buf = Buffer.alloc(8);
    token_amount_buf.writeBigUInt64LE(BigInt(tokenOut), 0);
    const slippage_buf = Buffer.alloc(8);
    slippage_buf.writeBigUInt64LE(BigInt(calc_slippage_up(solInLamports, slippageDecimal)), 0);
    const data = Buffer.concat([instruction_buf, token_amount_buf, slippage_buf]);

    const swapInstruction = new TransactionInstruction({
      keys: keys,
      programId: PUMP_FUN_PROGRAM,
      data: data
    })

    ixs.push(swapInstruction)

    // simulation process
    // const tx = new Transaction().add(...ixs)
    // tx.recentBlockhash = blockhash
    // tx.feePayer = buyerWallet

    // Compile message
    const blockhash = await connection.getLatestBlockhash()
    const messageV0 = new TransactionMessage({
      payerKey: buyerWallet,
      recentBlockhash: blockhash.blockhash,
      instructions: ixs,
    }).compileToV0Message()
    const transaction = new VersionedTransaction(messageV0)
    transaction.sign([buyerKeypair])
    // console.log("==============================================")
    // console.log(await connection.simulateTransaction(transaction))

    // Bundling process
    // console.log("JITO_MODE:", JITO_MODE);
    const buySig = await execute(transaction, blockhash)
    console.log(`Buy signature: https://solscan.io//transaction/${buySig}`)

    // if (JITO_MODE) {
    //   const result = await bundle([transaction], buyerKeypair, connection)
    //   console.log("Bundling result: ", result);
    // } else {
    // }
  } catch (e) {
    logger.debug(e)
    console.log(`Failed to buy token, ${mint}`)
  }

  console.log("---------Checking the buy result---------")
  let index = 0
  while (true) {
    if (index > txNum) {
      console.log("token sniping failed")
      return
    }
    try {
      const tokenBalance = (await connection.getTokenAccountBalance(buyerAta)).value.uiAmount
      if (tokenBalance && tokenBalance > 0) {
        console.log("🚀 ~ tokenBalance:", tokenBalance)
        isBought = true
        break
      }
    } catch (error) {
      index++
      await sleep(txDelay * 1000)
    }
  }
  console.log(`Successfully bought ${tokenMint} token.`)
}

const getPoolState = async (mint: PublicKey) => {
  // get the address of bonding curve and associated bonding curve
  [bonding] = PublicKey.findProgramAddressSync([BONDING_ADDR_SEED, mint.toBuffer()], TRADE_PROGRAM_ID);
  [assoc_bonding_addr] = PublicKey.findProgramAddressSync([bonding.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);

  // get the accountinfo of bonding curve
  const accountInfo = await connection.getAccountInfo(bonding, "processed")
  // console.log("🚀 ~ accountInfo:", accountInfo)
  if (!accountInfo) return

  // get the poolstate of the bonding curve
  const poolState = BONDING_CURV.decode(
    accountInfo.data
  );
  // console.log("🚀 ~ poolState:", poolState)
  // console.log("virtualTokenReserves: ", poolState.virtualTokenReserves.toString());
  // console.log("realTokenReserves: ", poolState.realTokenReserves.toString());

  // Calculate tokens out
  virtualSolReserves = poolState.virtualSolReserves;
  virtualTokenReserves = poolState.virtualTokenReserves;
}
