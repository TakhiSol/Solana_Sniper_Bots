import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { getPdaMetadataKey } from '@raydium-io/raydium-sdk';
import { MetadataAccountData, MetadataAccountDataArgs, getMetadataAccountDataSerializer } from '@metaplex-foundation/mpl-token-metadata';

export const checkBurn = async (connection: Connection, lpMint: PublicKey, commitment: Commitment) => {
  try {
    const amount = await connection.getTokenSupply(lpMint, commitment);
    const burned = amount.value.uiAmount === 0;
    return burned
  } catch (error) {
    return false
  }
}

export const checkMutable = async (connection: Connection, baseMint: PublicKey,) => {
  try {
    const metadataPDA = getPdaMetadataKey(baseMint);
    const metadataAccount = await connection.getAccountInfo(metadataPDA.publicKey);
    if (!metadataAccount?.data) {
      return { ok: false, message: 'Mutable -> Failed to fetch account data' };
    }
    const serializer = getMetadataAccountDataSerializer()
    const deserialize = serializer.deserialize(metadataAccount.data);
    const mutable = deserialize[0].isMutable;

    return !mutable
  } catch (e: any) {
    return false
  }
}



export const checkSocial = async (connection: Connection, baseMint: PublicKey, commitment: Commitment) => {
  try {
    const serializer = getMetadataAccountDataSerializer()
    const metadataPDA = getPdaMetadataKey(baseMint);
    const metadataAccount = await connection.getAccountInfo(metadataPDA.publicKey, commitment);
    if (!metadataAccount?.data) {
      return { ok: false, message: 'Mutable -> Failed to fetch account data' };
    }

    const deserialize = serializer.deserialize(metadataAccount.data);
    const social = await hasSocials(deserialize[0])
    return social
  } catch (error) {
    return false
  }
}

async function hasSocials(metadata: MetadataAccountData) {
  const response = await fetch(metadata.uri);
  const data = await response.json();
  return Object.values(data?.extensions ?? {}).some((value: any) => value !== null && value.length > 0);
}