const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo');
const BOT_KEYPAIR = [148,206,236,79,211,162,38,227,106,213,50,238,113,157,137,253,159,191,117,188,145,3,8,3,39,98,195,149,226,239,77,117,225,122,62,162,177,114,201,253,232,105,242,86,10,135,94,79,140,195,125,67,31,80,205,67,229,209,223,197,105,193,87,133];

// Discriminator for "initialize" instruction (anchor method)
const INIT_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function init() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const payer = Keypair.fromSecretKey(Uint8Array.from(BOT_KEYPAIR));
  
  // Derive master wallet PDA
  const [masterWalletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_wallet'), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Wallet:', payer.publicKey.toBase58());
  console.log('Master Wallet PDA:', masterWalletPda.toBase58());
  
  // Check if already initialized
  const accountInfo = await connection.getAccountInfo(masterWalletPda);
  if (accountInfo) {
    console.log('✅ Master wallet already initialized (account exists)');
    return;
  }
  
  console.log('Initializing master wallet...');
  
  // Create instruction
  const keys = [
    { pubkey: masterWalletPda, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  
  const instruction = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: INIT_DISCRIMINATOR,
  });
  
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = payer.publicKey;
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  transaction.sign(payer);
  
  const signature = await connection.sendRawTransaction(transaction.serialize());
  console.log('Transaction sent:', signature);
  
  await connection.confirmTransaction(signature);
  console.log('✅ Master wallet initialized!');
  console.log('Explorer: https://solscan.io/tx/' + signature + '?cluster=devnet');
}

init().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
