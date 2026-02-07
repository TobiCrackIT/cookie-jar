/**
 * Twitter/X API Integration
 * Listens for mentions and processes tip commands
 */

import { TwitterApi } from 'twitter-api-v2';
import { parseTipCommand, generateReplyMessage, type TipCommand } from '../parser/tipParser.js';
import { getWalletAddress, isWalletRegistered } from '../registry/walletRegistry.js';
import { executeTip, checkSufficientBalance } from '../solana/transfer.js';

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
      // Get recent mentions
      const mentions = await this.client.v2.mentions(this.userId!, {
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

    // Check if recipient is registered
    const recipientRegistered = await isWalletRegistered(command.recipientHandle);
    if (!recipientRegistered) {
      const error = `${command.recipientHandle} hasn't registered a wallet yet. They need to DM me "register <solana_address>" first.`;
      await this.replyToTweet(tweetId, generateReplyMessage(command, undefined, error));
      return;
    }

    // Check sender balance
    const hasBalance = await checkSufficientBalance(command.amount, command.token);
    if (!hasBalance) {
      const error = `Insufficient ${command.token} balance. Deposit to your linked wallet first.`;
      await this.replyToTweet(tweetId, generateReplyMessage(command, undefined, error));
      return;
    }

    // Get recipient address
    const recipientAddress = await getWalletAddress(command.recipientHandle);
    if (!recipientAddress) {
      const error = `Could not find wallet for ${command.recipientHandle}`;
      await this.replyToTweet(tweetId, generateReplyMessage(command, undefined, error));
      return;
    }

    // Execute the tip
    console.log(`[TwitterBot] Executing tip: ${command.amount} ${command.token} from ${senderHandle} to ${command.recipientHandle}`);
    
    const result = await executeTip(command, recipientAddress);

    // Reply with result
    const replyMessage = generateReplyMessage(
      command,
      result.signature,
      result.error
    );

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

    // Register command: "register <solana_address>"
    if (normalized.startsWith('register ')) {
      const address = text.split(' ')[1];
      
      if (!address || !isValidSolanaAddress(address)) {
        await this.sendDM(senderId, '❌ Invalid Solana address. Use: register <solana_address>');
        return;
      }

      // Get sender's username
      const user = await this.client.v2.user(senderId);
      const handle = `@${user.data.username}`;

      try {
        const { registerWallet } = await import('../registry/walletRegistry.js');
        await registerWallet(handle, address);
        await this.sendDM(senderId, `✅ Wallet registered! Your tips will be sent to: ${address}`);
      } catch (error) {
        await this.sendDM(senderId, '❌ Registration failed. You may already have a wallet registered.');
      }
    }

    // Balance command
    if (normalized === 'balance') {
      const { getBalance } = await import('../solana/transfer.js');
      const balance = await getBalance();
      await this.sendDM(senderId, `💰 Your balance:\nSOL: ${balance.sol}\nUSDC: ${balance.usdc}`);
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
