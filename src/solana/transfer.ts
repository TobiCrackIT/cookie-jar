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

// Devnet USDC mint address
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const DEVNET_RPC = 'https://api.devnet.solana.com';
const SOLANA_ADDRESS = 'GfeetWsqP1DKKiayvVqDNtEAxBVh4NvGcASoCnRNeMn2';

export async function getBalance(): Promise<{ sol: string; usdc: string }> {
  try {
    // Get SOL balance from devnet
    const solResponse = await fetch(DEVNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [SOLANA_ADDRESS],
      }),
    });
    const solData = await solResponse.json();
    const solBalance = (solData.result?.value || 0) / 1e9;

    // Get USDC balance from devnet
    const usdcResponse = await fetch(DEVNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          SOLANA_ADDRESS,
          { mint: DEVNET_USDC_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    });
    const usdcData = await usdcResponse.json();
    
    let usdcBalance = 0;
    if (usdcData.result?.value?.length > 0) {
      const tokenAccount = usdcData.result.value[0];
      const amount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
      usdcBalance = amount || 0;
    }

    return {
      sol: solBalance.toString(),
      usdc: usdcBalance.toString(),
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
