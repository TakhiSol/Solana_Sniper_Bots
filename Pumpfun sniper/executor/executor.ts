// Jito Bundling part

import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js"
import base58 from "bs58"
import { SearcherClient, searcherClient } from "jito-ts/dist/sdk/block-engine/searcher"
import { Bundle } from "jito-ts/dist/sdk/block-engine/types"
import { isError } from "jito-ts/dist/sdk/block-engine/utils"

import dotenv from "dotenv";
import { BLOCKENGINE_URL, JITO_AUTH_KEYPAIR, JITO_FEE } from "../src/constants"
dotenv.config();

export async function bundle(txs: VersionedTransaction[], keypair: Keypair, connection: Connection) {
  try {
    const txNum = Math.ceil(txs.length / 3)
    let successNum = 0;

    for (let i = 0; i < txNum; i++) {
      const upperIndex = (i + 1) * 3;
      const downIndex = i * 3;
      const newTxs = [];

      for (let j = downIndex; j < upperIndex; j++) {
        if (txs[j])
            newTxs.push(txs[j]);
      }
    
      let success = await bull_dozer(newTxs, keypair, connection);
      
      console.log('success', success);
      
      return success > 0 ? true : false;
    }
  } catch (error) {
    console.log(error);
  }
  return false;
}

export async function bull_dozer(txs: VersionedTransaction[], keypair: Keypair, connection: Connection) {
  try {

    console.log('bull_dozer');
    const bundleTransactionLimit = parseInt('4');

    const jito_auth_keypair_array = JITO_AUTH_KEYPAIR.split(',');
    const keyapair_num = Math.floor(Math.random() * jito_auth_keypair_array.length);
    const jito_auth_keypair = jito_auth_keypair_array[keyapair_num];
    const jitoKey = Keypair.fromSecretKey(base58.decode(jito_auth_keypair));
    console.log('jitoKey', jitoKey.publicKey)
    
    const blockengine_url_array = BLOCKENGINE_URL.split(',');
    const blockengine_num = Math.floor(Math.random() * blockengine_url_array.length);
    const blockengine_url = blockengine_url_array[blockengine_num];
    console.log('blockengine_url', blockengine_url);
    const search = searcherClient(blockengine_url, jitoKey);

    const ret = await build_bundle(
      search,
      bundleTransactionLimit,
      txs,
      keypair,
      connection
    );

    if (ret == null)
      return 0;

    const bundle_result = await onBundleResult(search);
    return bundle_result;
  } catch (error) {
    return 0;
  }
}

async function build_bundle(
  search: SearcherClient,
  bundleTransactionLimit: number,
  txs: VersionedTransaction[],
  keypair: Keypair,
  connection: Connection
) {
  const accounts = await search.getTipAccounts()
  // console.log("tip account:", accounts)
  const _tipAccount = accounts[Math.min(Math.floor(Math.random() * accounts.length), 3)]
  const tipAccount = new PublicKey(_tipAccount)

  const bund = new Bundle([], bundleTransactionLimit)
  const resp = await connection.getLatestBlockhash("confirmed")
  bund.addTransactions(...txs);

  console.log("--------------");
  // console.log(txs);

  let maybeBundle = bund.addTipTx(
    keypair,
    Number(JITO_FEE),
    tipAccount,
    resp.blockhash
  )
  // console.log({maybeBundle})

  if (isError(maybeBundle)) {
    throw maybeBundle
  }

  try {
    const result = await search.sendBundle(maybeBundle)
    console.log(result)
    // logger.info("Bundling done")
  } catch (e) {
    console.log(e)
    console.log("error in sending bundle\n");
    return null;
  }
  return maybeBundle
}

export const onBundleResult = (c: SearcherClient): Promise<number> => {
  let first = 0
  let isResolved = false

  return new Promise((resolve) => {
    // Set a timeout to reject the promise if no bundle is accepted within 30 seconds
    setTimeout(() => {
      resolve(first)
      isResolved = true
    }, 30000)

    c.onBundleResult(
      (result: any) => {
        if (isResolved) return first
        // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
        const bundleId = result.bundleId
        const isAccepted = result.accepted
        const isRejected = result.rejected
        if (isResolved == false) {

          if (isAccepted) {
            console.log(
              "bundle accepted, ID:",
              result.bundleId,
              " Slot: ",
              result.accepted!.slot
            )
            first += 1
            isResolved = true
            // Resolve with 'first' when a bundle is accepted
            resolve(first)
          }
          if (isRejected) {
            console.log("bundle is Rejected\n", result);
            // Do not resolve or reject the promise here
          }
          return
        }
      },
      (e: any) => {
        console.log(e)
        // Do not reject the promise here
      }
    )
  })
}