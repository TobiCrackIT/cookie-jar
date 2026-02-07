/**
 * On-Chain Tip Service
 * Integrates Twitter bot with the Solana Anchor program
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TipBotClient } from './programClient.js';
import type { TipCommand } from '../parser/tipParser.js';
import { getWalletAddress, isWalletRegistered, generateWallet, getUserKeypair } from '../registry/walletRegistry.js';

// Devnet connection
const DEVNET_RPC = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_RPC, 'confirmed');

// Bot's keypair - in production this should be from a secure vault
// For hackathon: load from env or generate ephemeral
const getBotKeypair = (): Keypair => {
  const privateKey = process.env.BOT_PRIVATE_KEY;
  if (privateKey) {
    const secretKey = Uint8Array.from(JSON.parse(privateKey));
    return Keypair.fromSecretKey(secretKey);
  }
  // Generate ephemeral (only for testing)
  console.warn('[OnChainTip] No BOT_PRIVATE_KEY set, using ephemeral keypair');
  return Keypair.generate();
};

// Create Anchor wallet adapter from keypair
class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() { return this.payer.publicKey; }
  async signTransaction(tx: any) {
    tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions(txs: any[]) {
    return txs.map(tx => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}

// Initialize client lazily
let tipBotClient: TipBotClient | null = null;

async function getClient(): Promise<TipBotClient> {
  if (!tipBotClient) {
    const keypair = getBotKeypair();
    const wallet = new NodeWallet(keypair) as any;
    tipBotClient = new TipBotClient(connection, wallet);
  }
  return tipBotClient;
}

export interface OnChainTipResult {
  success: boolean;
  signature?: string;
  explorerUrl?: string;
  error?: string;
  escrowed?: boolean;
}

/**
 * Initialize the master wallet (one-time setup)
 */
export async function initializeMasterWallet(): Promise<{ success: boolean; tx?: string; error?: string }> {
  try {
    const client = await getClient();
    const tx = await client.initialize();
    return {
      success: true,
      tx,
    };
  } catch (error) {
    // Master wallet may already be initialized
    if (error instanceof Error && error.message.includes('already in use')) {
      return { success: true };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register a user on-chain with auto-generated wallet
 * Bot creates and custodies the wallet for seamless UX
 */
export async function registerOnChain(
  twitterHandle: string
): Promise<{ success: boolean; address?: string; tx?: string; error?: string }> {
  try {
    // Generate wallet for user (bot custody for hackathon demo)
    const wallet = await generateWallet(twitterHandle);

    // Register on-chain
    const client = await getClient();
    const { tx } = await client.registerUser(twitterHandle);

    return {
      success: true,
      address: wallet.solanaAddress,
      tx,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Legacy: Register a user with their own external wallet
 */
export async function registerOnChainWithExternalWallet(
  twitterHandle: string,
  solanaAddress: string
): Promise<{ success: boolean; tx?: string; error?: string }> {
  try {
    // Register in local registry (no custody)
    const { registerWallet } = await import('../registry/walletRegistry.js');
    await registerWallet(twitterHandle, solanaAddress);

    // Then register on-chain
    const client = await getClient();
    const { tx } = await client.registerUser(twitterHandle);

    return {
      success: true,
      tx,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a tip between users
 * If recipient not registered on-chain, funds go to escrow
 */
export async function executeOnChainTip(
  command: TipCommand
): Promise<OnChainTipResult> {
  if (!command.isValid) {
    return { success: false, error: command.error };
  }

  try {
    const client = await getClient();
    const senderHandle = command.senderHandle;
    const recipientHandle = command.recipientHandle;
    const amount = parseFloat(command.amount);

    // Check if sender is registered on-chain
    const senderRegistered = await isWalletRegistered(senderHandle);
    if (!senderRegistered) {
      return {
        success: false,
        error: `You need to register first. DM me "register" to create your wallet.`,
      };
    }

    // Check if recipient is registered on-chain
    const recipientRegistered = await isWalletRegistered(recipientHandle);

    let signature: string;
    let escrowed = false;

    if (recipientRegistered) {
      // Direct tip between registered users
      signature = await client.tip(senderHandle, recipientHandle, amount);
    } else {
      // Tip to escrow for unregistered user
      signature = await client.tipToEscrow(senderHandle, recipientHandle, amount);
      escrowed = true;
    }

    const explorerUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;

    return {
      success: true,
      signature,
      explorerUrl,
      escrowed,
    };
  } catch (error) {
    console.error('[OnChainTip] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check user's on-chain balance
 */
export async function getOnChainBalance(
  twitterHandle: string
): Promise<{ balance: number; escrowBalance: number; error?: string }> {
  try {
    const client = await getClient();
    return await client.getBalance(twitterHandle);
  } catch (error) {
    return {
      balance: 0,
      escrowBalance: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Withdraw funds to external wallet
 */
export async function withdrawOnChain(
  twitterHandle: string,
  amount: number,
  recipientAddress: string
): Promise<{ success: boolean; tx?: string; error?: string }> {
  try {
    const client = await getClient();
    const recipientPubkey = new PublicKey(recipientAddress);
    const tx = await client.withdraw(twitterHandle, amount, recipientPubkey);
    return {
      success: true,
      tx,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if user has sufficient on-chain balance
 */
export async function checkOnChainBalance(
  twitterHandle: string,
  amount: number
): Promise<boolean> {
  const { balance } = await getOnChainBalance(twitterHandle);
  return balance >= amount;
}

/**
 * Get escrow balance for a user (tips waiting for them)
 */
export async function getEscrowBalance(twitterHandle: string): Promise<number> {
  try {
    const client = await getClient();
    return await client.getEscrowBalance(twitterHandle);
  } catch (error) {
    return 0;
  }
}
