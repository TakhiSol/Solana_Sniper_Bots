import { Logger } from 'pino';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs'
import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram, Keypair } from '@solana/web3.js';

const fileName2 = "./config_sniper.json"
let file_content2 = fs.readFileSync(fileName2, 'utf-8');
let content2 = JSON.parse(file_content2);
const computeUnit = content2.computeUnit;

dotenv.config();

export const retrieveEnvVariable = (variableName: string, logger: Logger) => {
  const variable = process.env[variableName] || '';
  if (!variable) {
    console.log(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
};

export async function findData(data: any, field: string): Promise<any | null> {
  if (typeof data === 'object') {
    if (field in data) {
      return data[field];
    } else {
      for (const value of Object.values(data)) {
        const result = await findData(value, field);
        if (result !== null) {
          return result;
        }
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      const result = await findData(item, field);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// Function to save data to JSON file
export const saveDataToFile = (data: any, filePath: string = "data.json") => {
  try {
    // Convert data to JSON format
    const jsonData = JSON.stringify(data);

    // Write JSON data to file
    fs.writeFileSync(filePath, jsonData);

    console.log('Data saved to JSON file successfully.');
  } catch (error) {
    console.error('Error saving data to JSON file:', error);
  }
};


export function generateDistribution(
  totalValue: number,
  minValue: number,
  maxValue: number,
  num: number,
  mode: string,
): number[] {
  if (mode == "even") {
    let element = totalValue / num;
    let array = [];
    for (let i = 0; i < num; i++)
      array.push(element);
    return array
  }

  // Early checks for impossible scenarios
  if (num * minValue > totalValue || num * maxValue < totalValue) {
    throw new Error('Impossible to satisfy the constraints with the given values.');
  }

  // Start with an evenly distributed array
  let distribution: number[] = new Array(num).fill(minValue);
  let currentTotal: number = minValue * num;

  // Randomly add to each to reach totalValue
  // ensuring values stay within minValue and maxValue
  for (let i = 0; currentTotal < totalValue && i < 10000; i++) {
    for (let j = 0; j < num; j++) {
      // Calculate remaining space to ensure constraints are not broken
      const spaceLeft = Math.min(totalValue - currentTotal, maxValue - distribution[j]);
      if (spaceLeft <= 0) continue;

      // Randomly decide how much to add within the space left
      const addValue = Math.floor(Math.random() * (spaceLeft + 1));
      distribution[j] += addValue;
      currentTotal += addValue;

      // Break early if the target is reached
      if (currentTotal === totalValue) break;
    }
  }

  // In cases where distribution cannot reach totalValue due to rounding, adjust the last element
  // This is safe due to the initial constraints check ensuring a solution exists
  if (currentTotal !== totalValue) {
    const difference = totalValue - currentTotal;
    for (let i = distribution.length - 1; i >= 0; i--) {
      const potentialValue = distribution[i];
      if (potentialValue <= maxValue) {
        distribution[i] += difference;
        break;
      }
    }
  }
  for (let i = 0; i < distribution.length; i++)
    distribution[i] = Math.floor(distribution[i])

  return distribution;
}

export function bufferFromUInt64(value: number | string) {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export async function createTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: PublicKey,
  priorityFeeInSol: number = 0  /// == 16_000_000_000_000_000
): Promise<Transaction> {
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnit,
  });

  const transaction = new Transaction().add(modifyComputeUnits);

  if (priorityFeeInSol > 0) {                     // 100_000_000_000_000
      const microLamports = Math.round(priorityFeeInSol * 1_000_000_000 / computeUnit ) * 10 ** 6; // convert SOL to microLamports
      // const microLamports = 100_000;
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports,
      });
      transaction.add(addPriorityFee);
  }

  transaction.add(...instructions);

  transaction.feePayer = payer;
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  return transaction;
}

export async function sendAndConfirmTransactionWrapper(connection: Connection, transaction: Transaction, signers: any[]) {
  try {
      const signature = await sendAndConfirmTransaction(connection, transaction, signers, { skipPreflight: true});
      console.log('Transaction confirmed with signature:', signature);
      return signature;
  } catch (error) {
      console.error('Error sending transaction:', error);
      return null;
  }
}