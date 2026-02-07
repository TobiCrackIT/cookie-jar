/**
 * TipBot - Main Entry Point
 * Twitter/X bot for Solana micropayments
 */

import 'dotenv/config';
import { TwitterBot } from './twitter/bot.js';

async function main() {
  console.log('🚀 Starting TipBot...');
  console.log('Bot Handle:', process.env.BOT_HANDLE || '@cookkiiee_bot');
  console.log('Network:', process.env.SOLANA_NETWORK || 'devnet');

  const bot = new TwitterBot();

  try {
    await bot.init();
    await bot.startMentionStream();
    console.log('✅ TipBot is running!');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down TipBot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down TipBot...');
  process.exit(0);
});

main();
