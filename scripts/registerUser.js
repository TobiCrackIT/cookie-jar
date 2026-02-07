const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

const PROGRAM_ID = new PublicKey('JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo');
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Bot wallet (acts as the authority)
const BOT_KEYPAIR = [148,206,236,79,211,162,38,227,106,213,50,238,113,157,137,253,159,191,117,188,145,3,8,3,39,98,195,149,226,239,77,117,225,122,62,162,177,114,201,253,232,105,242,86,10,135,94,79,140,195,125,67,31,80,205,67,229,209,223,197,105,193,87,133];

// Discriminator for "registerUser" instruction
const REGISTER_DISCRIMINATOR = Buffer.from([189, 127, 244, 221, 73, 180, 210, 93]);

async function registerUser(twitterHandle, userWalletKeypair) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const botKeypair = Keypair.fromSecretKey(Uint8Array.from(BOT_KEYPAIR));
  const userKeypair = Keypair.fromSecretKey(Uint8Array.from(userWalletKeypair));
  
  console.log('Bot Wallet:', botKeypair.publicKey.toBase58());
  console.log('User Wallet:', userKeypair.publicKey.toBase58());
  console.log('Twitter Handle:', twitterHandle);
  
  // Derive master wallet PDA
  const [masterWalletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_wallet'), botKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive user account PDA
  const handleLower = twitterHandle.toLowerCase().replace('@', '');
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(handleLower), masterWalletPda.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive user's token account
  const [tokenPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token'), userPda.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive escrow account PDA
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(handleLower), masterWalletPda.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive escrow token account
  const escrowTokenAccount = await getAssociatedTokenAddress(
    DEVNET_USDC_MINT,
    escrowPda,
    true
  );
  
  console.log('Master Wallet PDA:', masterWalletPda.toBase58());
  console.log('User Account PDA:', userPda.toBase58());
  console.log('User Token Account:', tokenPda.toBase58());
  console.log('Escrow Account:', escrowPda.toBase58());
  console.log('Escrow Token Account:', escrowTokenAccount.toBase58());
  
  // Build instruction data: discriminator + twitter_handle string
  const handleBuffer = Buffer.from(handleLower);
  const handleLenBuffer = Buffer.alloc(4);
  handleLenBuffer.writeUInt32LE(handleBuffer.length, 0);
  const data = Buffer.concat([REGISTER_DISCRIMINATOR, handleLenBuffer, handleBuffer]);
  
  // Build instruction accounts
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
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // rent sysvar
  ];
  
  const { TransactionInstruction, Transaction } = require('@solana/web3.js');
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
  
  console.log('\nSending registration transaction...');
  const signature = await connection.sendRawTransaction(transaction.serialize());
  console.log('Transaction sent:', signature);
  
  await connection.confirmTransaction(signature);
  console.log('✅ User registered successfully!');
  console.log('Explorer: https://solscan.io/tx/' + signature + '?cluster=devnet');
  
  return {
    userPda: userPda.toBase58(),
    signature,
  };
}

// Generate a test user wallet
const testUserKeypair = Array.from(Keypair.generate().secretKey);
console.log('Test User Keypair (save this):');
console.log(JSON.stringify(testUserKeypair));
console.log('\nTo register a user, run:');
console.log('node scripts/registerUser.js <twitter_handle>');
console.log('\nExample with the generated keypair:');
console.log('const USER_KEYPAIR = ' + JSON.stringify(testUserKeypair) + ';');

// If run with args
if (process.argv[2]) {
  const handle = process.argv[2];
  // Use the generated keypair for testing
  registerUser(handle, testUserKeypair).catch(console.error);
}
