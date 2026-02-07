/**
 * Twitter/X API Integration
 * Listens for mentions and processes tip commands
 */

import { TwitterApi } from 'twitter-api-v2';
import { parseTipCommand, generateReplyMessage, type TipCommand } from '../parser/tipParser.js';
import { getWalletAddress, isWalletRegistered, registerWallet } from '../registry/walletRegistry.js';
import {
  executeOnChainTip,
  checkOnChainBalance,
  registerOnChain,
  getOnChainBalance,
  withdrawOnChain,
  getEscrowBalance,
  initializeMasterWallet,
} from '../solana/onChainService.js';

const BOT_HANDLE = process.env.BOT_HANDLE || '@cookkiiee_bot';
const REPLY_FROM = process.env.REPLY_FROM_HANDLE || '@ooluwatobig';

export class TwitterBot {
  private client: TwitterApi;
  private userId: string | null = null;

  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
  }

  async init(): Promise<void> {
    const user = await this.client.v2.me();
    this.userId = user.data.id;
    console.log(`[TwitterBot] Initialized as @${user.data.username} (ID: ${this.userId})`);

    // Initialize on-chain master wallet
    const initResult = await initializeMasterWallet();
    if (initResult.success) {
      console.log('[TwitterBot] On-chain master wallet initialized');
    } else {
      console.warn('[TwitterBot] Master wallet init warning:', initResult.error);
    }
  }

  // Start streaming mentions
  async startMentionStream(): Promise<void> {
    if (!this.userId) {
      throw new Error('Bot not initialized');
    }

    console.log('[TwitterBot] Starting mention stream...');

    // For hackathon MVP: Poll mentions every 30 seconds
    // In production: Use webhook streaming
    setInterval(async () => {
      await this.checkMentions();
    }, 30000);

    // Initial check
    await this.checkMentions();
  }

  private async checkMentions(): Promise<void> {
    try {
      // Get recent mentions using search instead of mentions endpoint
      // The mentions endpoint requires elevated access, so we search for @bot_handle
      const query = `@${BOT_HANDLE.replace('@', '')} -from:${BOT_HANDLE.replace('@', '')}`;
      const mentions = await this.client.v2.search(query, {
        max_results: 10,
        'tweet.fields': ['author_id', 'created_at', 'conversation_id'],
        'user.fields': ['username'],
        expansions: ['author_id'],
      });

      if (!mentions.data?.data?.length) {
        return;
      }

      for (const tweet of mentions.data.data) {
        await this.processMention(tweet);
      }
    } catch (error) {
      console.error('[TwitterBot] Error checking mentions:', error);
    }
  }

  private async processMention(tweet: any): Promise<void> {
    const tweetId = tweet.id;
    const text = tweet.text;
    const authorId = tweet.author_id;

    // Get author's username
    const user = await this.client.v2.user(authorId);
    const senderHandle = `@${user.data.username}`;

    console.log(`[TwitterBot] Mention from ${senderHandle}: ${text}`);

    // Parse the tip command
    const command = parseTipCommand(text, senderHandle, tweetId, BOT_HANDLE);

    if (!command.isValid) {
      // Reply with error
      await this.replyToTweet(tweetId, generateReplyMessage(command));
      return;
    }

    // Check if sender is registered on-chain
    const senderRegistered = await isWalletRegistered(senderHandle);
    if (!senderRegistered) {
      const error = `You need to register first. DM me "register <your_solana_address>" to set up your wallet.`;
      await this.replyToTweet(tweetId, generateReplyMessage(command, undefined, error));
      return;
    }

    // Check sender's on-chain balance
    const amount = parseFloat(command.amount);
    const hasBalance = await checkOnChainBalance(senderHandle, amount);
    if (!hasBalance) {
      const error = `Insufficient USDC balance. Deposit to your linked wallet first.`;
      await this.replyToTweet(tweetId, generateReplyMessage(command, undefined, error));
      return;
    }

    // Execute the on-chain tip
    console.log(`[TwitterBot] Executing on-chain tip: ${command.amount} USDC from ${senderHandle} to ${command.recipientHandle}`);
    
    const result = await executeOnChainTip(command);

    // Build reply message
    let replyMessage: string;
    if (result.success) {
      const escrowNote = result.escrowed 
        ? `\n\n💡 ${command.recipientHandle} isn't registered yet. Funds are held in escrow until they register.` 
        : '';
      replyMessage = `✅ Sent ${command.amount} USDC to ${command.recipientHandle}!${escrowNote}\n\nView: ${result.explorerUrl}`;
    } else {
      replyMessage = `❌ Tip failed: ${result.error}`;
    }

    await this.replyToTweet(tweetId, replyMessage);
  }

  private async replyToTweet(tweetId: string, message: string): Promise<void> {
    try {
      // Twitter has a 280 character limit
      const truncatedMessage = message.length > 280 
        ? message.substring(0, 277) + '...'
        : message;

      await this.client.v2.reply(truncatedMessage, tweetId);
      console.log(`[TwitterBot] Replied to ${tweetId}`);
    } catch (error) {
      console.error('[TwitterBot] Error replying:', error);
    }
  }

  // Handle DM-based wallet registration
  async processDM(senderId: string, text: string): Promise<void> {
    const normalized = text.toLowerCase().trim();

    // Get sender's username
    const user = await this.client.v2.user(senderId);
    const handle = `@${user.data.username}`;

    // Register command: "register" (auto-generates wallet)
    if (normalized === 'register') {
      try {
        const result = await registerOnChain(handle);
        if (result.success) {
          const message = `✅ Wallet created and registered!

📍 Your address: ${result.address}

💡 This is a custodial wallet for the hackathon demo. You can:
• Receive tips immediately
• Check balance anytime
• Withdraw to your own wallet anytime

Your funds are safe and you control withdrawals.`;
          await this.sendDM(senderId, message);
        } else {
          await this.sendDM(senderId, `❌ Registration failed: ${result.error}`);
        }
      } catch (error) {
        await this.sendDM(senderId, '❌ Registration failed. You may already have a wallet registered.');
      }
    }

    // Legacy: Register with external wallet: "register <solana_address>"
    if (normalized.startsWith('register ') && normalized !== 'register') {
      const address = text.split(' ')[1];
      
      if (!address || !isValidSolanaAddress(address)) {
        await this.sendDM(senderId, '❌ Invalid Solana address. Use: register <solana_address>');
        return;
      }

      try {
        const { registerOnChainWithExternalWallet } = await import('../solana/onChainService.js');
        const result = await registerOnChainWithExternalWallet(handle, address);
        if (result.success) {
          await this.sendDM(senderId, `✅ External wallet registered! Your on-chain account is ready.\n\nAddress: ${address}\n\nYou can now receive tips and your existing escrowed funds will be auto-claimed.`);
        } else {
          await this.sendDM(senderId, `❌ Registration failed: ${result.error}`);
        }
      } catch (error) {
        await this.sendDM(senderId, '❌ Registration failed. You may already have a wallet registered.');
      }
    }

    // Balance command
    if (normalized === 'balance') {
      const { balance, escrowBalance } = await getOnChainBalance(handle);
      const escrowNote = escrowBalance > 0 ? `\n⏳ Escrowed (waiting): ${escrowBalance} USDC` : '';
      await this.sendDM(senderId, `💰 Your on-chain balance:\nAvailable: ${balance} USDC${escrowNote}`);
    }

    // Escrow command - check pending tips
    if (normalized === 'escrow') {
      const escrowBalance = await getEscrowBalance(handle);
      if (escrowBalance > 0) {
        await this.sendDM(senderId, `⏳ You have ${escrowBalance} USDC waiting in escrow. Register your wallet to claim it!`);
      } else {
        await this.sendDM(senderId, `No funds in escrow. When someone tips you before you register, the funds will be held here.`);
      }
    }

    // Withdraw command: "withdraw <amount> <address>"
    if (normalized.startsWith('withdraw ')) {
      const parts = text.split(' ');
      if (parts.length < 3) {
        await this.sendDM(senderId, '❌ Usage: withdraw <amount> <solana_address>');
        return;
      }
      const amount = parseFloat(parts[1]);
      const recipientAddress = parts[2];

      if (isNaN(amount) || amount <= 0) {
        await this.sendDM(senderId, '❌ Invalid amount');
        return;
      }

      if (!isValidSolanaAddress(recipientAddress)) {
        await this.sendDM(senderId, '❌ Invalid Solana address');
        return;
      }

      const result = await withdrawOnChain(handle, amount, recipientAddress);
      if (result.success) {
        await this.sendDM(senderId, `✅ Withdrew ${amount} USDC to ${recipientAddress}\n\nTx: ${result.tx}`);
      } else {
        await this.sendDM(senderId, `❌ Withdraw failed: ${result.error}`);
      }
    }
  }

  private async sendDM(userId: string, message: string): Promise<void> {
    // Note: Twitter API v2 doesn't support DMs easily
    // For hackathon, we can use v1.1 or just reply publicly
    console.log(`[DM to ${userId}]: ${message}`);
  }
}

function isValidSolanaAddress(address: string): boolean {
  // Basic validation: Solana addresses are base58 encoded and 32-44 chars
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
