const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { readFileSync } = require('fs');

const PROGRAM_SO_PATH = '/root/clawd/tipbot/target/deploy/tipbot.so';
const BOT_KEYPAIR = JSON.parse(process.env.BOT_PRIVATE_KEY || '[]');

async function deploy() {
  if (BOT_KEYPAIR.length === 0) {
    console.error('BOT_PRIVATE_KEY not set');
    process.exit(1);
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const payer = Keypair.fromSecretKey(Uint8Array.from(BOT_KEYPAIR));
  const programKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync('/root/clawd/tipbot/programs/tipbot/target/deploy/tipbot-keypair.json', 'utf8')))
  );

  console.log('Deployer:', payer.publicKey.toBase58());
  console.log('Program ID:', programKeypair.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');

  if (balance < 10000000) {
    console.error('Insufficient balance for deployment');
    process.exit(1);
  }

  // Load program binary
  const programData = readFileSync(PROGRAM_SO_PATH);
  console.log('Program size:', programData.length, 'bytes');

  // Calculate rent exemption
  const rentExemption = await connection.getMinimumBalanceForRentExemption(programData.length);
  console.log('Rent exemption:', rentExemption / 1e9, 'SOL');

  // Check if program already exists
  const accountInfo = await connection.getAccountInfo(programKeypair.publicKey);
  if (accountInfo) {
    console.log('Program already deployed!');
    console.log('Account data size:', accountInfo.data.length);
    return;
  }

  console.log('Deploying program...');
  console.log('Note: This requires solana CLI. Please run manually:');
  console.log('');
  console.log('cd /root/clawd/tipbot');
  console.log('solana config set --url devnet');
  console.log('solana program deploy target/deploy/tipbot.so --program-id target/deploy/tipbot-keypair.json --keypair <(echo "[' + BOT_KEYPAIR.join(',') + ']")');
}

deploy().catch(console.error);
