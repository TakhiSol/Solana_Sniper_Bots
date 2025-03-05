import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { getPdaMetadataKey } from "@raydium-io/raydium-sdk";
import {
  MetadataAccountData,
  MetadataAccountDataArgs,
  getMetadataAccountDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from 'fs';
import * as path from 'path';
import readline from 'readline';
import { getMetaData } from "../getMetaData";
import { CHECK_NAMEBLACKLIST, CHECK_NAMEWHITELIST, CHECK_SOCIAL, CHECK_SOLDBALANCE, CHECK_WALLETBLACKLIST, CHECK_WALLETWHITELIST, MINIMUMTOKENBALANCEPERCENT } from "../src/constants";
import { TokenAmount } from "@solana/web3.js";
import { sleep } from "../utility";

export const filterToken = async (
  connection: Connection,
  baseMint: PublicKey,
  commitment: Commitment,
  wallet: PublicKey,
  tokenPoolAta: PublicKey
) => {
  try {
    const metaData = await getMetaData(connection, baseMint, commitment);
    // console.log("waiting 2 seconds for the metadata fetching");
    // sleep(2000)

    let hasSocialState = true;
    let hasWhiteListNameState = true;
    let hasBlackListNameState = false;
    let hasWhiteListWalletState = true;
    let hasBlackListWalletState = false;
    let tokenBuyState = true;

    if (metaData)
      console.log("🚀 ~ hasSocials ~ data:", metaData);

    if (CHECK_SOCIAL && metaData) {
      // filtering social
      if(hasSocial(metaData)) hasSocialState = hasSocial(metaData);
      else hasSocialState = false;
      console.log("🚀 ~ hasSocials:", hasSocialState)
    }

    if (CHECK_NAMEWHITELIST && metaData) {
      // filtering whitelist of keyword
      const hasWhiteListNameState = hasWhiteListName(metaData);
      console.log("🚀 ~ hasWhiteListNameState:", hasWhiteListNameState)
    }

    if (CHECK_NAMEBLACKLIST && metaData) {
      // filtering whitelist of keyword
      const hasBlackListNameState = hasBlackListName(metaData);
      console.log("🚀 ~ hasBlackListNameState:", hasBlackListNameState)
    }

    if (CHECK_WALLETWHITELIST) {
      // filtering whitelist of wallet
      const hasWhiteListWalletState = hasWhiteListWallet(wallet)
      console.log("🚀 ~ hasWhiteListWalletState:", hasWhiteListWalletState)
    }

    if (CHECK_WALLETBLACKLIST) {
      // filtering blacklist of wallet
      const hasBlackListWalletState = hasBlackListWallet(wallet)
      console.log("🚀 ~ hasBlackListWalletState:", hasBlackListWalletState)
    }

    if (CHECK_SOLDBALANCE) {
      // filtering sold amount of token
      let index = 0
      while (true) {
        if (index > 10) {
          console.log("Error getting token balance")
          tokenBuyState = false
          break
        }
        try {
          const tokenBal = (await connection.getTokenAccountBalance(tokenPoolAta, "confirmed")).value.uiAmount;
          console.log("🚀 ~ tokenBal:", tokenBal)
          const tokenBuyState = filterTokenBalance(tokenBal!);
          console.log("🚀 ~ tokenBuyState:", tokenBuyState)
          break
        } catch (error) {
          // console.log(error)
          index++
        }
        await sleep(500)
        index++
      }
    }

    const buyableState = hasSocialState && hasWhiteListNameState && !hasBlackListNameState && hasWhiteListWalletState && !hasBlackListWalletState && tokenBuyState;

    return buyableState;

  } catch (error) {
    // console.log(error);
    return false;
  }
}

// function to filter the social
const hasSocial = (metaData: any) => {
  return metaData.twitter || metaData.telegram || metaData.website
}

// function to filter the whitelist name
const hasWhiteListName = (metaData: any) => {
  const data = fs.readFileSync(path.join(__dirname, 'whitelist.txt'), 'utf-8');
  const whiteList = data
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => {
      if (a == metaData.name) return a;
    });
  console.log("🚀 ~ hasWhiteListName ~ metaData.name:", metaData.name)
  console.log("🚀 ~ hasWhiteListName ~ whitelistname:", whiteList)
  if(whiteList.length) return true;
  return false;
}

// function to filter the blacklist name
const hasBlackListName = (metaData: any) => {
  const data = fs.readFileSync(path.join(__dirname, 'blacklist.txt'), 'utf-8');
  const blackList = data
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => {
      if (a == metaData.name) return a;
    });
  console.log("🚀 ~ hasBlackListName ~ metaData.name:", metaData.name)
  console.log("🚀 ~ hasBlackListName ~ data:", blackList)

  if(blackList.length) return true;
  return false;
}

// function to filter the blacklist of wallets
const hasWhiteListWallet = (wallet: PublicKey) => {
  const data = fs.readFileSync(path.join(__dirname, 'whitelistwallet.txt'), 'utf-8');
  const whiteList = data
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => {
      if (a == wallet.toString()) return a;
    });

  console.log("🚀 ~ hasWhiteListWallet ~ wallet:", wallet.toString())
  console.log("🚀 ~ hasWhiteListWallet ~ data:", whiteList)
  
  if(whiteList.length) return true
  return false
}

// function to filter the blacklist of wallets
const hasBlackListWallet = (wallet: PublicKey) => {
  const data = fs.readFileSync(path.join(__dirname, 'blacklistwallet.txt'), 'utf-8');
  const blackList = data
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => {
      if (a == wallet.toString()) return a;
    });

  console.log("🚀 ~ hasBlackListWallet ~ wallet:", wallet.toString())
  console.log("🚀 ~ hasBlackListWallet ~ data:", blackList)
  
  if(blackList.length) return true
  return false
}

// function to filter the balance of token
const filterTokenBalance = (balance: number) => {
  console.log("🚀 ~ filterTokenBalance ~ 10 ** 9 - balance:", 10 ** 9 - balance)
  return (10 ** 9 - balance) / 10 ** 9 < MINIMUMTOKENBALANCEPERCENT / 100;
}