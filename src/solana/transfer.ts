/**
 * Solana Transfer Service using AgentWallet
 */

import type { TipCommand } from '../parser/tipParser.js';

const AGENTWALLET_API_URL = 'https://agentwallet.mcpay.tech/api';
const AGENTWALLET_USERNAME = process.env.AGENTWALLET_USERNAME || 'cookiebotai';
const AGENTWALLET_TOKEN = process.env.AGENTWALLET_API_TOKEN || '';

// Token mint addresses
const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
};

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
  explorerUrl?: string;
}

export async function executeTip(
  command: TipCommand,
  recipientAddress: string
): Promise<TransferResult> {
  if (!command.isValid) {
    return { success: false, error: command.error };
  }

  try {
    // Convert amount to lamports/smallest unit
    const amount = command.token === 'SOL' 
      ? BigInt(Math.floor(parseFloat(command.amount) * 1e9)) // SOL has 9 decimals
      : BigInt(Math.floor(parseFloat(command.amount) * 1e6)); // USDC has 6 decimals

    // Build transfer request
    const transferBody = {
      to: recipientAddress,
      amount: amount.toString(),
      asset: command.token.toLowerCase(),
      network: 'devnet', // Start with devnet for hackathon
    };

    console.log(`[Transfer] Sending ${command.amount} ${command.token} to ${recipientAddress}`);

    // Execute transfer via AgentWallet
    const response = await fetch(
      `${AGENTWALLET_API_URL}/wallets/${AGENTWALLET_USERNAME}/actions/transfer-solana`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AGENTWALLET_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transferBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Transfer failed: ${error}`);
    }

    const result = await response.json();
    const signature = result.txHash || result.signature;
    const explorerUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;

    console.log(`[Transfer] Success! Signature: ${signature}`);

    return {
      success: true,
      signature,
      explorerUrl,
    };

  } catch (error) {
    console.error('[Transfer] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getBalance(): Promise<{ sol: string; usdc: string }> {
  try {
    const response = await fetch(
      `${AGENTWALLET_API_URL}/wallets/${AGENTWALLET_USERNAME}/balances`,
      {
        headers: {
          'Authorization': `Bearer ${AGENTWALLET_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }

    const data = await response.json();
    
    return {
      sol: data.sol || '0',
      usdc: data.usdc || '0',
    };
  } catch (error) {
    console.error('[Balance] Error:', error);
    return { sol: '0', usdc: '0' };
  }
}

// Check if sender has sufficient balance
export async function checkSufficientBalance(
  amount: string,
  token: 'USDC' | 'SOL'
): Promise<boolean> {
  const balance = await getBalance();
  const currentBalance = parseFloat(token === 'USDC' ? balance.usdc : balance.sol);
  const requiredAmount = parseFloat(amount);
  
  return currentBalance >= requiredAmount;
}
