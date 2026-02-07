/**
 * Test Registration Flow - Raw Transaction Version
 */

// Load environment variables
require('dotenv').config();

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { generateWallet, getUserKeypair, isWalletRegistered, getWalletAddress } = require('../dist/registry/walletRegistry.js');

const PROGRAM_ID = new PublicKey('JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo');
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Discriminator for "register_user" instruction (SHA256("global:register_user")[0:8])
const REGISTER_DISCRIMINATOR = Buffer.from([2, 241, 150, 223, 99, 214, 116, 97]);

// Test user
const TEST_TWITTER_HANDLE = '@demo' + Math.floor(Math.random() * 10000);

async function testRegistration() {
  console.log('🧪 Testing Registration Flow\n');
  console.log('='.repeat(60));

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Step 1: Generate wallet for user
  console.log('\n1️⃣ Generating wallet for', TEST_TWITTER_HANDLE);
  let wallet;
  try {
    wallet = await generateWallet(TEST_TWITTER_HANDLE);
    console.log('   ✓ Wallet generated!');
    console.log('   Address:', wallet.solanaAddress);
  } catch (e) {
    console.error('   ❌ Failed to generate wallet:', e.message);
    throw e;
  }

  // Step 2: Get bot keypair (for deriving master wallet)
  console.log('\n2️⃣ Loading bot wallet...');
  const botPrivateKey = process.env.BOT_PRIVATE_KEY;
  if (!botPrivateKey) {
    throw new Error('BOT_PRIVATE_KEY not set in environment');
  }
  let botKeypair;
  try {
    botKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(botPrivateKey)));
    console.log('   Bot wallet:', botKeypair.publicKey.toBase58());
  } catch (e) {
    console.error('   ❌ Failed to load bot keypair:', e.message);
    throw e;
  }

  // Derive PDAs
  const [masterWalletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_wallet'), botKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const handleLower = TEST_TWITTER_HANDLE.toLowerCase().replace('@', '');
  
  // Debug: Check the wallet mapping
  const { getWalletMapping } = require('../dist/registry/walletRegistry.js');
  const mapping = await getWalletMapping(TEST_TWITTER_HANDLE);
  console.log('   Wallet mapping:', mapping ? 'found' : 'not found');
  if (mapping) {
    console.log('   Private key length:', mapping.privateKey.length);
    console.log('   First few bytes:', mapping.privateKey.slice(0, 5));
  }
  
  const userKeypair = await getUserKeypair(TEST_TWITTER_HANDLE);
  
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(handleLower), masterWalletPda.toBuffer()],
    PROGRAM_ID
  );

  const [tokenPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token'), userPda.toBuffer()],
    PROGRAM_ID
  );

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(handleLower), masterWalletPda.toBuffer()],
    PROGRAM_ID
  );

  const { getAssociatedTokenAddress } = require('@solana/spl-token');
  const escrowTokenAccount = await getAssociatedTokenAddress(
    DEVNET_USDC_MINT,
    escrowPda,
    true
  );

  console.log('\n3️⃣ Derived PDAs:');
  console.log('   Master Wallet:', masterWalletPda.toBase58());
  console.log('   User Account:', userPda.toBase58());
  console.log('   User Token Account:', tokenPda.toBase58());
  console.log('   Escrow Account:', escrowPda.toBase58());
  console.log('   Escrow Token Account:', escrowTokenAccount.toBase58());

  // Step 3: Fund user wallet for transaction fees (transfer from bot)
  console.log('\n4️⃣ Funding user wallet with devnet SOL...');
  try {
    // Transfer SOL from bot to user for transaction fees
    const { SystemProgram, Transaction: SolTx } = require('@solana/web3.js');
    const fundTx = new SolTx().add(
      SystemProgram.transfer({
        fromPubkey: botKeypair.publicKey,
        toPubkey: userKeypair.publicKey,
        lamports: 0.05 * 1e9, // 0.05 SOL
      })
    );
    fundTx.feePayer = botKeypair.publicKey;
    const { blockhash: bh } = await connection.getLatestBlockhash();
    fundTx.recentBlockhash = bh;
    fundTx.sign(botKeypair);
    
    const fundSig = await connection.sendRawTransaction(fundTx.serialize());
    await connection.confirmTransaction(fundSig);
    console.log('   ✓ Funded 0.05 SOL from bot! Tx:', fundSig);
  } catch (e) {
    console.log('   ⚠️ Funding failed:', e.message);
    console.log('   Trying airdrop instead...');
    try {
      const airdropSig = await connection.requestAirdrop(userKeypair.publicKey, 0.1 * 1e9);
      await connection.confirmTransaction(airdropSig);
      console.log('   ✓ Airdropped 0.1 SOL! Tx:', airdropSig);
    } catch (e2) {
      console.log('   ❌ Both funding methods failed');
      throw e2;
    }
  }

  // Step 4: Build registration transaction
  console.log('\n5️⃣ Building registration transaction...');
  
  // Instruction data: discriminator + twitter_handle string
  const handleBuffer = Buffer.from(handleLower);
  const handleLenBuffer = Buffer.alloc(4);
  handleLenBuffer.writeUInt32LE(handleBuffer.length, 0);
  const data = Buffer.concat([REGISTER_DISCRIMINATOR, handleLenBuffer, handleBuffer]);

  // Instruction accounts
  const keys = [
    { pubkey: masterWalletPda, isSigner: false, isWritable: true },
    { pubkey: userPda, isSigner: false, isWritable: true },
    { pubkey: userKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: tokenPda, isSigner: false, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
    { pubkey: DEVNET_USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = userKeypair.publicKey;

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  transaction.sign(userKeypair);

  // Step 5: Send transaction
  console.log('\n6️⃣ Sending registration transaction...');
  try {
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log('   Transaction sent:', signature);
    
    await connection.confirmTransaction(signature);
    console.log('   ✅ Registration successful!');
    console.log('   Explorer: https://solscan.io/tx/' + signature + '?cluster=devnet');

    // Step 6: Verify
    console.log('\n7️⃣ Verifying registration...');
    const registered = await isWalletRegistered(TEST_TWITTER_HANDLE);
    const address = await getWalletAddress(TEST_TWITTER_HANDLE);
    console.log('   Registered:', registered);
    console.log('   Address:', address);

  } catch (error) {
    console.error('   ❌ Registration failed:', error.message);
    if (error.message.includes('already in use')) {
      console.log('   ℹ️ Account already exists');
    }
    throw error;
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Registration test complete!');
  console.log('\nUser can now:');
  console.log('• Receive tips from other users');
  console.log('• Check balance with "balance" command');
  console.log('• Withdraw with "withdraw <amount> <address>"');
}

testRegistration().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
