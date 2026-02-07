/**
 * Handle-to-Wallet Registry
 * Maps Twitter handles to Solana wallet addresses
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export interface WalletMapping {
  twitterHandle: string;
  solanaAddress: string;
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

export async function getWalletAddress(twitterHandle: string): Promise<string | null> {
  const registry = await loadRegistry();
  const mapping = registry.get(twitterHandle.toLowerCase());
  return mapping?.solanaAddress || null;
}

export async function registerWallet(
  twitterHandle: string,
  solanaAddress: string
): Promise<WalletMapping> {
  const registry = await loadRegistry();
  
  const now = new Date().toISOString();
  const mapping: WalletMapping = {
    twitterHandle: twitterHandle.toLowerCase(),
    solanaAddress,
    createdAt: registry.get(twitterHandle.toLowerCase())?.createdAt || now,
    updatedAt: now,
  };

  registry.set(twitterHandle.toLowerCase(), mapping);
  await saveRegistry(registry);

  return mapping;
}

export async function isWalletRegistered(twitterHandle: string): Promise<boolean> {
  const address = await getWalletAddress(twitterHandle);
  return address !== null;
}

// For MVP: Auto-register users on first deposit
// In production, this should require signature verification
export async function autoRegisterFromDeposit(
  twitterHandle: string,
  solanaAddress: string
): Promise<WalletMapping> {
  const existing = await getWalletAddress(twitterHandle);
  if (existing) {
    throw new Error('Handle already registered');
  }

  return registerWallet(twitterHandle, solanaAddress);
}
