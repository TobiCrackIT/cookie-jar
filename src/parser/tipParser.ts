/**
 * Parses Twitter mentions for tip commands
 * Format: "@cookkiiee_bot tip @username <amount> <token>"
 * Example: "@cookkiiee_bot tip @alice 0.005 USDC"
 */

export interface TipCommand {
  senderHandle: string;
  recipientHandle: string;
  amount: string;
  token: 'USDC' | 'SOL';
  tweetId: string;
  isValid: boolean;
  error?: string;
}

const TOKEN_ALIASES: Record<string, 'USDC' | 'SOL'> = {
  'usdc': 'USDC',
  '$usdc': 'USDC',
  'sol': 'SOL',
  '$sol': 'SOL',
  '◎': 'SOL',
};

export function parseTipCommand(
  tweetText: string,
  senderHandle: string,
  tweetId: string,
  botHandle: string = '@cookkiiee_bot'
): TipCommand {
  // Normalize text
  const normalized = tweetText.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Check if bot is mentioned
  if (!normalized.includes(botHandle.toLowerCase())) {
    return {
      senderHandle,
      recipientHandle: '',
      amount: '',
      token: 'USDC',
      tweetId,
      isValid: false,
      error: 'Bot not mentioned',
    };
  }

  // Parse tip command
  // Pattern: @bot tip @recipient <amount> <token>
  const tipPattern = new RegExp(
    `${botHandle.toLowerCase()}\\s+tip\\s+(@\\w+)\\s+([0-9.]+)\\s*(\\$?\\w+)`,
    'i'
  );

  const match = normalized.match(tipPattern);

  if (!match) {
    return {
      senderHandle,
      recipientHandle: '',
      amount: '',
      token: 'USDC',
      tweetId,
      isValid: false,
      error: 'Invalid format. Use: @cookkiiee_bot tip @username <amount> <token>',
    };
  }

  const [, recipientHandle, amountStr, tokenStr] = match;
  const token = TOKEN_ALIASES[tokenStr.toLowerCase()];

  if (!token) {
    return {
      senderHandle,
      recipientHandle,
      amount: amountStr,
      token: 'USDC',
      tweetId,
      isValid: false,
      error: `Unsupported token: ${tokenStr}. Use USDC or SOL.`,
    };
  }

  // Validate amount
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return {
      senderHandle,
      recipientHandle,
      amount: amountStr,
      token,
      tweetId,
      isValid: false,
      error: 'Invalid amount',
    };
  }

  // Minimum amounts
  const minAmount = token === 'USDC' ? 0.001 : 0.001;
  if (amount < minAmount) {
    return {
      senderHandle,
      recipientHandle,
      amount: amountStr,
      token,
      tweetId,
      isValid: false,
      error: `Minimum tip is ${minAmount} ${token}`,
    };
  }

  return {
    senderHandle,
    recipientHandle,
    amount: amountStr,
    token,
    tweetId,
    isValid: true,
  };
}

// Helper to generate reply message
export function generateReplyMessage(
  command: TipCommand,
  txSignature?: string,
  error?: string
): string {
  if (!command.isValid) {
    return `❌ ${command.error}`;
  }

  if (error) {
    return `❌ Tip failed: ${error}`;
  }

  if (txSignature) {
    const explorerUrl = `https://solscan.io/tx/${txSignature}`;
    return `✅ Sent ${command.amount} ${command.token} to ${command.recipientHandle}!\n\nView: ${explorerUrl}`;
  }

  return `⏳ Processing tip...`;
}
