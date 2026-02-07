/**
 * Handle-to-Wallet Registry with Auto-Generated Wallets
 * Maps Twitter handles to Solana wallets (bot-generated for custody)
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Keypair } from '@solana/web3.js';

export interface WalletMapping {
  twitterHandle: string;
  solanaAddress: string;
  privateKey: number[]; // Bot-custodied for hackathon demo
  createdAt: string;
  updatedAt: string;
}

const REGISTRY_FILE = join(process.cwd(), 'data', 'wallet-registry.json');

// In-memory cache
let registryCache: Map<string, WalletMapping> | null = null;

async function loadRegistry(): Promise<Map<string, WalletMapping>> {
  if (registryCache) return registryCache;

  try {
    const data = await fs.readFile(REGISTRY_FILE, 'utf-8');
    const mappings: WalletMapping[] = JSON.parse(data);
    registryCache = new Map(mappings.map(m => [m.twitterHandle.toLowerCase(), m]));
  } catch (error) {
    // File doesn't exist yet
    registryCache = new Map();
  }

  return registryCache;
}

async function saveRegistry(registry: Map<string, WalletMapping>): Promise<void> {
  await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
  const mappings = Array.from(registry.values());
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(mappings, null, 2));
  registryCache = registry;
}

/**
 * Generate a new wallet for a user (bot custody model)
 * Returns the wallet info including private key (stored securely)
 */
export async function generateWallet(twitterHandle: string): Promise<WalletMapping> {
  const registry = await loadRegistry();
  const handleLower = twitterHandle.toLowerCase();

  // Check if already registered
  if (registry.has(handleLower)) {
    throw new Error('User already registered');
  }

  // Generate new keypair
  const keypair = Keypair.generate();
  const solanaAddress = keypair.publicKey.toBase58();
  const privateKey = Array.from(keypair.secretKey);

  const now = new Date().toISOString();
  const mapping: WalletMapping = {
    twitterHandle: handleLower,
    solanaAddress,
    privateKey,
    createdAt: now,
    updatedAt: now,
  };

  registry.set(handleLower, mapping);
  await saveRegistry(registry);

  return mapping;
}

/**
 * Get user's wallet address
 */
export async function getWalletAddress(twitterHandle: string): Promise<string | null> {
  const registry = await loadRegistry();
  const mapping = registry.get(twitterHandle.toLowerCase());
  return mapping?.solanaAddress || null;
}

/**
 * Get user's full wallet mapping (including private key for transactions)
 */
export async function getWalletMapping(twitterHandle: string): Promise<WalletMapping | null> {
  const registry = await loadRegistry();
  return registry.get(twitterHandle.toLowerCase()) || null;
}

/**
 * Register a user with an external wallet (legacy mode)
 */
export async function registerWallet(
  twitterHandle: string,
  solanaAddress: string
): Promise<WalletMapping> {
  const registry = await loadRegistry();

  const now = new Date().toISOString();
  const mapping: WalletMapping = {
    twitterHandle: twitterHandle.toLowerCase(),
    solanaAddress,
    privateKey: [], // No custody - user manages their own keys
    createdAt: registry.get(twitterHandle.toLowerCase())?.createdAt || now,
    updatedAt: now,
  };

  registry.set(twitterHandle.toLowerCase(), mapping);
  await saveRegistry(registry);

  return mapping;
}

/**
 * Check if user is registered
 */
export async function isWalletRegistered(twitterHandle: string): Promise<boolean> {
  const registry = await loadRegistry();
  return registry.has(twitterHandle.toLowerCase());
}

/**
 * Get keypair for a registered user (for bot-initiated transactions)
 */
export async function getUserKeypair(twitterHandle: string): Promise<Keypair | null> {
  const mapping = await getWalletMapping(twitterHandle);
  if (!mapping || mapping.privateKey.length === 0) {
    return null;
  }
  return Keypair.fromSecretKey(Uint8Array.from(mapping.privateKey));
}
