const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const idl = require('../src/solana/idl.json');

const PROGRAM_ID = new PublicKey('5pnqVk9Ezxd4mwu3pznGt1kGDvKaER8Bzp6jp4TP6tBM');
const BOT_KEYPAIR = [148,206,236,79,211,162,38,227,106,213,50,238,113,157,137,253,159,191,117,188,145,3,8,3,39,98,195,149,226,239,77,117,225,122,62,162,177,114,201,253,232,105,242,86,10,135,94,79,140,195,125,67,31,80,205,67,229,209,223,197,105,193,87,133];

async function init() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypair = Keypair.fromSecretKey(Uint8Array.from(BOT_KEYPAIR));
  const wallet = new anchor.Wallet(keypair);
  
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);
  
  const program = new anchor.Program(idl, provider);
  
  // Derive master wallet PDA
  const [masterWalletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_wallet'), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Master Wallet PDA:', masterWalletPda.toBase58());
  
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        masterWallet: masterWalletPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('✅ Master wallet initialized!');
    console.log('Transaction:', tx);
    console.log('Explorer: https://solscan.io/tx/' + tx + '?cluster=devnet');
  } catch (err) {
    if (err.message && err.message.includes('already in use')) {
      console.log('✅ Master wallet already initialized');
    } else if (err.message && err.message.includes('custom program error')) {
      console.log('ℹ️ Master wallet may already exist or other program error');
      console.log('Error:', err.message);
    } else {
      console.error('Error:', err);
    }
  }
}

init();
