import {
  BigNumberish,
  Liquidity,
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityPoolKeys,
  LiquidityPoolKeysV4,
  LiquidityStateV4,
  MARKET_STATE_LAYOUT_V3,
  MarketStateV3,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import {
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Keypair,
  Connection,
  PublicKey,
  KeyedAccountInfo,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { getTokenAccounts, RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, OPENBOOK_PROGRAM_ID, createPoolKeys } from './liquidity'
import { deleteConsoleLines, logger } from './utils'
import { getMinimalMarketV3, MinimalMarketLayoutV3 } from './market'
import { MintLayout } from './types'
import bs58 from 'bs58'
import * as fs from 'fs'
import * as path from 'path'
import readline from 'readline'
import {
  CHECK_IF_MINT_IS_RENOUNCED,
  COMMITMENT_LEVEL,
  LOG_LEVEL,
  MAX_SELL_RETRIES,
  PRIVATE_KEY,
  QUOTE_AMOUNT,
  QUOTE_MINT,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  SNIPE_LIST_REFRESH_INTERVAL,
  USE_SNIPE_LIST,
  MIN_POOL_SIZE,
  MAX_POOL_SIZE,
  ONE_TOKEN_AT_A_TIME,
  PRICE_CHECK_DURATION,
  PRICE_CHECK_INTERVAL,
  TAKE_PROFIT1,
  TAKE_PROFIT2,
  STOP_LOSS,
  SELL_SLIPPAGE,
  CHECK_IF_MINT_IS_MUTABLE,
  CHECK_IF_MINT_IS_BURNED,
  JITO_MODE,
  JITO_ALL,
  SELL_AT_TP1,
  JITO_FEE,
  CHECK_SOCIAL,
  WAIT_UNTIL_LP_IS_BURNT,
  LP_BURN_WAIT_TIME,
} from './constants'
import { clearMonitor, monitor } from './monitor'
import { BN } from 'bn.js'
import { checkBurn, checkMutable, checkSocial } from './tokenFilter'
import { bundle } from './executor/jito'
import { execute } from './executor/legacy'
import { jitoWithAxios } from './executor/jitoWithAxios'
import { PoolKeys } from './utils/getPoolKeys'

const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
})

export interface MinimalTokenAccountData {
  mint: PublicKey
  address: PublicKey
  poolKeys?: LiquidityPoolKeys
  market?: MinimalMarketLayoutV3
}
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const existingLiquidityPools: Set<string> = new Set<string>()
const existingOpenBookMarkets: Set<string> = new Set<string>()
const existingTokenAccounts: Map<string, MinimalTokenAccountData> = new Map<string, MinimalTokenAccountData>()

let wallet: Keypair
let quoteToken: Token
let quoteTokenAssociatedAddress: PublicKey
let quoteAmount: TokenAmount
let quoteMinPoolSizeAmount: TokenAmount
let quoteMaxPoolSizeAmount: TokenAmount
let processingToken: Boolean = false
let poolId: PublicKey
let tokenAccountInCommon: MinimalTokenAccountData | undefined
let accountDataInCommon: LiquidityStateV4 | undefined
let idDealt: string = NATIVE_MINT.toBase58()
let snipeList: string[] = []
let timesChecked: number = 0
let soldSome: boolean = false


async function init(): Promise<void> {
  logger.level = LOG_LEVEL

  // get wallet
  wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
  const solBalance = await solanaConnection.getBalance(wallet.publicKey)
  console.log(`Wallet Address: ${wallet.publicKey}`)
  console.log(`SOL balance: ${(solBalance / 10 ** 9).toFixed(3)}SOL`)

  // get quote mint and amount
  switch (QUOTE_MINT) {
    case 'WSOL': {
      quoteToken = Token.WSOL
      quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false)
      quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false)
      quoteMaxPoolSizeAmount = new TokenAmount(quoteToken, MAX_POOL_SIZE, false)
      break
    }
    case 'USDC': {
      quoteToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        6,
        'USDC',
        'USDC',
      )
      quoteAmount = new TokenAmount(quoteToken, QUOTE_AMOUNT, false)
      quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false)
      quoteMaxPoolSizeAmount = new TokenAmount(quoteToken, MAX_POOL_SIZE, false)
      break
    }
    default: {
      throw new Error(`Unsupported quote mint "${QUOTE_MINT}". Supported values are USDC and WSOL`)
    }
  }

  console.log(`Snipe list: ${USE_SNIPE_LIST}`)
  console.log(`Check mint renounced: ${CHECK_IF_MINT_IS_RENOUNCED}`)
  console.log(`Check token socials: ${CHECK_SOCIAL}`)
  console.log(
    `Min pool size: ${quoteMinPoolSizeAmount.isZero() ? 'false' : quoteMinPoolSizeAmount.toFixed(2)} ${quoteToken.symbol}`,
  )
  console.log(
    `Max pool size: ${quoteMaxPoolSizeAmount.isZero() ? 'false' : quoteMaxPoolSizeAmount.toFixed(2)} ${quoteToken.symbol}`,
  )
  console.log(`One token at a time: ${ONE_TOKEN_AT_A_TIME}`)
  console.log(`Buy amount: ${quoteAmount.toFixed()} ${quoteToken.symbol}`)

  // check existing wallet for associated token account of quote mint
  const tokenAccounts = await getTokenAccounts(solanaConnection, wallet.publicKey, COMMITMENT_LEVEL)

  for (const ta of tokenAccounts) {
    existingTokenAccounts.set(ta.accountInfo.mint.toString(), <MinimalTokenAccountData>{
      mint: ta.accountInfo.mint,
      address: ta.pubkey,
    })
  }

  quoteTokenAssociatedAddress = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey)

  const wsolBalance = await solanaConnection.getBalance(quoteTokenAssociatedAddress)

  console.log(`WSOL Balance: ${wsolBalance}`)
  if (!(!wsolBalance || wsolBalance == 0))
    // await unwrapSol(quoteTokenAssociatedAddress)
    // load tokens to snipe
    loadSnipeList()
}

function saveTokenAccount(mint: PublicKey, accountData: MinimalMarketLayoutV3) {
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey)
  const tokenAccount = <MinimalTokenAccountData>{
    address: ata,
    mint: mint,
    market: <MinimalMarketLayoutV3>{
      bids: accountData.bids,
      asks: accountData.asks,
      eventQueue: accountData.eventQueue,
    },
  }
  existingTokenAccounts.set(mint.toString(), tokenAccount)
  return tokenAccount
}

export async function processRaydiumPool(id: PublicKey, poolState: LiquidityStateV4) {
  
  // Some parts are missing (Contact: https://t.me/Takhi777)

}

export async function checkMintable(vault: PublicKey): Promise<boolean | undefined> {
  try {
    let { data } = (await solanaConnection.getAccountInfo(vault)) || {}
    if (!data) {
      return
    }
    const deserialize = MintLayout.decode(data)
    return deserialize.mintAuthorityOption === 0
  } catch (e) {
    logger.debug(e)
    console.log(`Failed to check if mint is renounced`, vault)
  }
}

export async function processOpenBookMarket(updatedAccountInfo: KeyedAccountInfo) {
  let accountData: MarketStateV3 | undefined
  try {
    accountData = MARKET_STATE_LAYOUT_V3.decode(updatedAccountInfo.accountInfo.data)

    // to be competitive, we collect market data before buying the token...
    if (existingTokenAccounts.has(accountData.baseMint.toString())) {
      return
    }

    saveTokenAccount(accountData.baseMint, accountData)
  } catch (e) {
    logger.debug(e)
    console.log(`Failed to process market, mint: `, accountData?.baseMint)
  }
}

async function buy(accountId: PublicKey, accountData: LiquidityStateV4): Promise<void> {
  console.log(`Buy action triggered`)
  try {
    let tokenAccount = existingTokenAccounts.get(accountData.baseMint.toString())
    tokenAccountInCommon = tokenAccount
    accountDataInCommon = accountData
    if (!tokenAccount) {
      // it's possible that we didn't have time to fetch open book data
      const market = await getMinimalMarketV3(solanaConnection, accountData.marketId, COMMITMENT_LEVEL)
      tokenAccount = saveTokenAccount(accountData.baseMint, market)
    }

    tokenAccount.poolKeys = createPoolKeys(accountId, accountData, tokenAccount.market!)
    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: tokenAccount.poolKeys,
        userKeys: {
          tokenAccountIn: quoteTokenAssociatedAddress,
          tokenAccountOut: tokenAccount.address,
          owner: wallet.publicKey,
        },
        amountIn: quoteAmount.raw,
        minAmountOut: 0,
      },
      tokenAccount.poolKeys.version,
    )

    const latestBlockhash = await solanaConnection.getLatestBlockhash({
      commitment: COMMITMENT_LEVEL,
    })

    const instructions: TransactionInstruction[] = []

    if (!await solanaConnection.getAccountInfo(quoteTokenAssociatedAddress))
      instructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          quoteTokenAssociatedAddress,
          wallet.publicKey,
          NATIVE_MINT,
        )
      )
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: quoteTokenAssociatedAddress,
        lamports: Math.ceil(parseFloat(QUOTE_AMOUNT) * 10 ** 9),
      }),
      createSyncNativeInstruction(quoteTokenAssociatedAddress, TOKEN_PROGRAM_ID),
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        tokenAccount.address,
        wallet.publicKey,
        accountData.baseMint,
      ),
      ...innerTransaction.instructions,
    )

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message()
    const transaction = new VersionedTransaction(messageV0)
    transaction.sign([wallet, ...innerTransaction.signers])

    if (JITO_MODE) {
      if (JITO_ALL) {
        await jitoWithAxios(transaction, wallet, latestBlockhash)
      } else {
        const result = await bundle([transaction], wallet)
      }
    } else {
      await execute(transaction, latestBlockhash)
    }
  } catch (e) {
    logger.debug(e)
    console.log(`Failed to buy token, ${accountData.baseMint}`)
  }
}

export async function sell(mint: PublicKey, amount: BigNumberish, isTp1Sell: boolean = false): Promise<void> {
  try {
    const tokenAccount = existingTokenAccounts.get(mint.toString())

    if (!tokenAccount) {
      console.log("Sell token account not exist")
      return
    }

    if (!tokenAccount.poolKeys) {
      console.log('No pool keys found: ', mint)
      return
    }

    if (amount == "0") {
      console.log(`Checking: Sold already`, tokenAccount.mint)
      return
    }

    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: tokenAccount.poolKeys!,
        userKeys: {
          tokenAccountOut: quoteTokenAssociatedAddress,
          tokenAccountIn: tokenAccount.address,
          owner: wallet.publicKey,
        },
        amountIn: amount,
        minAmountOut: 0,
      },
      tokenAccount.poolKeys!.version,
    )

    const tx = new Transaction().add(...innerTransaction.instructions)
    tx.feePayer = wallet.publicKey
    tx.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash

    const latestBlockhash = await solanaConnection.getLatestBlockhash({
      commitment: COMMITMENT_LEVEL,
    })

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ...innerTransaction.instructions,
        createCloseAccountInstruction(quoteTokenAssociatedAddress, wallet.publicKey, wallet.publicKey),
      ],
    }).compileToV0Message()

    const transaction = new VersionedTransaction(messageV0)
    transaction.sign([wallet, ...innerTransaction.signers])
    if (JITO_MODE) {
      if (JITO_ALL) {
        await jitoWithAxios(transaction, wallet, latestBlockhash)
      } else {
        await bundle([transaction], wallet)
      }
    } else {
      await execute(transaction, latestBlockhash)
    }
  } catch (e: any) {
    await sleep(1000)
    logger.debug(e)
  }

  setTimeout(() => {
    processingToken = false
  }, 15000)

  if (!isTp1Sell) {
    await sell(mint, amount, true)
  }
}

function loadSnipeList() {
  if (!USE_SNIPE_LIST) {
    return
  }
  const count = snipeList.length
  const data = fs.readFileSync(path.join(__dirname, 'snipe-list.txt'), 'utf-8')
  snipeList = data
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a)

  if (snipeList.length != count) {
    console.log(`Loaded snipe list: ${snipeList.length}`)
  }
}

function shouldBuy(key: string): boolean {
  return USE_SNIPE_LIST ? snipeList.includes(key) : ONE_TOKEN_AT_A_TIME ? !processingToken : true
}

const runListener = async () => {
  await init()

  trackWallet(solanaConnection)

  const runTimestamp = Math.floor(new Date().getTime() / 1000)
  const raydiumSubscriptionId = solanaConnection.onProgramAccountChange(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString()
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data)
      const poolOpenTime = parseInt(poolState.poolOpenTime.toString())
      const existing = existingLiquidityPools.has(key)

      if (poolOpenTime > runTimestamp && !existing) {
        existingLiquidityPools.add(key)
        const _ = processRaydiumPool(updatedAccountInfo.accountId, poolState)
        poolId = updatedAccountInfo.accountId
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
          bytes: quoteToken.mint.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
          bytes: OPENBOOK_PROGRAM_ID.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
          bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
        },
      },
    ],
  )

  const openBookSubscriptionId = solanaConnection.onProgramAccountChange(
    OPENBOOK_PROGRAM_ID,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString()
      const existing = existingOpenBookMarkets.has(key)
      if (!existing) {
        existingOpenBookMarkets.add(key)
        const _ = processOpenBookMarket(updatedAccountInfo)
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: MARKET_STATE_LAYOUT_V3.span },
      {
        memcmp: {
          offset: MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint'),
          bytes: quoteToken.mint.toBase58(),
        },
      },
    ],
  )

  const walletSubscriptionId = solanaConnection.onProgramAccountChange(
    TOKEN_PROGRAM_ID,
    async (updatedAccountInfo) => {
      await walletChange(updatedAccountInfo)
    },
    COMMITMENT_LEVEL,
    [
      {
        dataSize: 165,
      },
      {
        memcmp: {
          offset: 32,
          bytes: wallet.publicKey.toBase58(),
        },
      },
    ],
  )

  console.log(`Listening for wallet changes: ${walletSubscriptionId}`)
  // }

  console.log(`Listening for raydium changes: ${raydiumSubscriptionId}`)
  console.log(`Listening for open book changes: ${openBookSubscriptionId}`)

  console.log('----------------------------------------')
  console.log('Bot is running! Press CTRL + C to stop it.')
  console.log('----------------------------------------')

  if (USE_SNIPE_LIST) {
    setInterval(loadSnipeList, SNIPE_LIST_REFRESH_INTERVAL * 1000)
  }
}

const unwrapSol = async (wSolAccount: PublicKey) => {
  try {
    const wsolAccountInfo = await solanaConnection.getAccountInfo(wSolAccount)
    if (wsolAccountInfo) {
      const wsolBalanace = await solanaConnection.getBalance(wSolAccount)
      console.log(`Trying to unwrap ${wsolBalanace / 10 ** 9}wsol to sol`)
      const instructions = []

      instructions.push(
        createCloseAccountInstruction(
          wSolAccount,
          wallet.publicKey,
          wallet.publicKey
        )
      )
      const latestBlockhash = await solanaConnection.getLatestBlockhash({
        commitment: COMMITMENT_LEVEL,
      })

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [...instructions],
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)
      transaction.sign([wallet])
      if (JITO_MODE) {
        if (JITO_ALL) {
          const result = await jitoWithAxios(transaction, wallet, latestBlockhash)
        } else {
          const result = await bundle([transaction], wallet)
        }
      } else {
        await execute(transaction, latestBlockhash)
      }
      await sleep(5000)
      const wBal = await solanaConnection.getBalance(wSolAccount)
      if (wBal > 0) {
        console.log("Unwrapping WSOL failed")
      } else {
        console.log("Successfully unwrapped WSOL to SOL")
      }
    }
  } catch (error) {
    console.log("Error unwrapping WSOL")
  }
}

const inputAction = async (accountId: PublicKey, mint: PublicKey, amount: BigNumberish) => {
  console.log("\n\n\n==========================================================\n\n\n")
  rl.question('If you want to sell, plz input "sell" and press enter: \n\n', async (data) => {
    const input = data.toString().trim()
    if (input === 'sell') {
      timesChecked = 1000000
    } else {
      console.log('Received input invalid :\t', input)
      inputAction(accountId, mint, amount)
    }
  })
}

const priceMatch = async (amountIn: TokenAmount, poolKeys: LiquidityPoolKeysV4) => {
  try {
    if (PRICE_CHECK_DURATION === 0 || PRICE_CHECK_INTERVAL === 0)
      return
    let priceMatchAtOne = false
    const timesToCheck = PRICE_CHECK_DURATION / PRICE_CHECK_INTERVAL
    const temp = amountIn.raw.toString()
    const tokenAmount = new BN(temp.substring(0, temp.length - 2))
    const sellAt1 = tokenAmount.mul(new BN(SELL_AT_TP1)).toString()
    const slippage = new Percent(SELL_SLIPPAGE, 100)

    const tp1 = Number((Number(QUOTE_AMOUNT) * (100 + TAKE_PROFIT1) / 100).toFixed(4))
    const tp2 = Number((Number(QUOTE_AMOUNT) * (100 + TAKE_PROFIT2) / 100).toFixed(4))
    const sl = Number((Number(QUOTE_AMOUNT) * (100 - STOP_LOSS) / 100).toFixed(4))
    timesChecked = 0
    do {
      try {
        const poolInfo = await Liquidity.fetchInfo({
          connection: solanaConnection,
          poolKeys,
        })

        const { amountOut } = Liquidity.computeAmountOut({
          poolKeys,
          poolInfo,
          amountIn,
          currencyOut: quoteToken,
          slippage,
        })
        const pnl = (Number(amountOut.toFixed(6)) - Number(QUOTE_AMOUNT)) / Number(QUOTE_AMOUNT) * 100
        if (timesChecked > 0) {
          deleteConsoleLines(1)
        }
        console.log(`Take profit1: ${tp1} SOL | Take profit2: ${tp2} SOL  | Stop loss: ${sl} SOL | Buy amount: ${QUOTE_AMOUNT} SOL | Current: ${amountOut.toFixed(4)} SOL | PNL: ${pnl.toFixed(3)}%`)
        const amountOutNum = Number(amountOut.toFixed(7))
        if (amountOutNum < sl) {
          console.log("Token is on stop loss point, will sell with loss")
          break
        }

        // if (amountOutNum > tp1) {
        if (pnl > TAKE_PROFIT1) {
          if (!priceMatchAtOne) {
            console.log("Token is on first level profit, will sell some and wait for second level higher profit")
            priceMatchAtOne = true
            soldSome = true
            sell(poolKeys.baseMint, sellAt1, true)
            // break
          }
        }

        // if (amountOutNum < tp1 && priceMatchAtOne) {
        if (pnl < TAKE_PROFIT1 && priceMatchAtOne) {
          console.log("Token is on first level profit again, will sell with first level")
          break
        }

        // if (amountOutNum > tp2) {
        if (pnl > TAKE_PROFIT2) {
          console.log("Token is on second level profit, will sell with second level profit")
          break
        }

      } catch (e) {
      } finally {
        timesChecked++
      }
      await sleep(PRICE_CHECK_INTERVAL * 1000)
    } while (timesChecked < timesToCheck)
  } catch (error) {
    console.log("Error when setting profit amounts", error)
  }
}

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

let bought: string = NATIVE_MINT.toBase58()

const walletChange = async (updatedAccountInfo: KeyedAccountInfo) => {
  const accountData = AccountLayout.decode(updatedAccountInfo.accountInfo!.data)
  if (updatedAccountInfo.accountId.equals(quoteTokenAssociatedAddress)) {
    return
  }
  if (tokenAccountInCommon && accountDataInCommon) {

    if (bought != accountDataInCommon.baseMint.toBase58()) {
      console.log(`\n--------------- bought token successfully ---------------------- \n`)
      console.log(`https://dexscreener.com/solana/${accountDataInCommon.baseMint.toBase58()}`)
      console.log(`PHOTON: https://photon-sol.tinyastro.io/en/lp/${tokenAccountInCommon.poolKeys!.id.toString()}`)
      console.log(`DEXSCREENER: https://dexscreener.com/solana/${tokenAccountInCommon.poolKeys!.id.toString()}`)
      console.log(`JUPITER: https://jup.ag/swap/${accountDataInCommon.baseMint.toBase58()}-SOL`)
      console.log(`BIRDEYE: https://birdeye.so/token/${accountDataInCommon.baseMint.toBase58()}?chain=solana\n\n`)
      bought = accountDataInCommon.baseMint.toBase58()

      const tokenAccount = await getAssociatedTokenAddress(accountData.mint, wallet.publicKey)
      const tokenBalance = await getTokenBalance(tokenAccount)
      if (tokenBalance == "0") {
        console.log(`Detected a new pool, but didn't confirm buy action`)
        return
      }

      const tokenIn = new Token(TOKEN_PROGRAM_ID, tokenAccountInCommon.poolKeys!.baseMint, tokenAccountInCommon.poolKeys!.baseDecimals)
      const tokenAmountIn = new TokenAmount(tokenIn, tokenBalance, true)
      inputAction(updatedAccountInfo.accountId, accountData.mint, tokenBalance)
      await priceMatch(tokenAmountIn, tokenAccountInCommon.poolKeys!)


      const tokenBalanceAfterCheck = await getTokenBalance(tokenAccount)
      if (tokenBalanceAfterCheck == "0") {
        return
      }
      if (soldSome) {
        soldSome = false
        const _ = await sell(tokenAccountInCommon.poolKeys!.baseMint, tokenBalanceAfterCheck)
      } else {
        const _ = await sell(tokenAccountInCommon.poolKeys!.baseMint, accountData.amount)
      }
    }
  }
}

const getTokenBalance = async (tokenAccount: PublicKey) => {
  let tokenBalance = "0"
  let index = 0
  do {
    try {
      const tokenBal = (await solanaConnection.getTokenAccountBalance(tokenAccount, 'processed')).value
      const uiAmount = tokenBal.uiAmount
      if (index > 10) {
        break
      }
      if (uiAmount && uiAmount > 0) {
        tokenBalance = tokenBal.amount
        console.log(`Token balance is ${uiAmount}`)
        break
      }
      await sleep(1000)
      index++
    } catch (error) {
      await sleep(500)
    }
  } while (true);
  return tokenBalance
}


async function trackWallet(connection: Connection): Promise<void> {
  try {
    const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey)
    connection.onLogs(
      wsolAta,
      async ({ logs, err, signature }) => {
        if (err)
          console.log("Transaction failed")
        else {
          console.log(`\nTransaction success: https://solscan.io/tx/${signature}\n`)
        }
      },
      "confirmed"
    );
  } catch (error) {
    console.log("Transaction error : ", error)
  }
}

runListener()


