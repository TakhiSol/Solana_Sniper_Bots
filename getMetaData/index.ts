import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { getPdaMetadataKey } from "@raydium-io/raydium-sdk";
import {
  MetadataAccountData,
  MetadataAccountDataArgs,
  getMetadataAccountDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";

export const getMetaData = async (
  connection: Connection,
  baseMint: PublicKey,
  commitment: Commitment
) => {
  try {
    const serializer = getMetadataAccountDataSerializer();
    const metadataPDA = getPdaMetadataKey(baseMint);
    const metadataAccount = await connection.getAccountInfo(
      metadataPDA.publicKey,
      commitment
    );
    if (!metadataAccount?.data) {
      return false;
    }

    const deserialize = serializer.deserialize(metadataAccount.data);
    // console.log("🚀 ~ deserialize:", deserialize)
    const metaData = (await fetch(deserialize[0].uri)).json();
    return metaData;
  } catch (error) {
    return false;
  }
}