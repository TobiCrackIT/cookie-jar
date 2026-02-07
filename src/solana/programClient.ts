/**
 * On-chain TipBot Program Client
 * Interacts with the Solana program for custodial wallets
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, web3, BN } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// Devnet USDC mint
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Program ID (placeholder - will be updated after deployment)
const PROGRAM_ID = new PublicKey('TipBot1111111111111111111111111111111111111');

interface TipBotProgram {
  methods: {
    initialize(): any;
    registerUser(twitterHandle: string): any;
    deposit(amount: BN): any;
    tip(amount: BN, recipientHandle: string): any;
    withdraw(amount: BN): any;
  };
  accounts: any;
}

export class TipBotClient {
  private program: Program<TipBotProgram>;
  private provider: anchor.Provider;
  private masterWalletPda: PublicKey;
  private masterWalletBump: number;

  constructor(connection: web3.Connection, wallet: anchor.Wallet) {
    this.provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(this.provider);

    // Load the program
    this.program = new Program(require('./idl.json'), PROGRAM_ID, this.provider);

    // Derive master wallet PDA
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('master_wallet'), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    this.masterWalletPda = pda;
    this.masterWalletBump = bump;
  }

  /**
   * Initialize the master wallet (one-time setup)
   */
  async initialize(): Promise<string> {
    const tx = await this.program.methods
      .initialize()
      .accounts({
        masterWallet: this.masterWalletPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Register a new user with their Twitter handle
   */
  async registerUser(twitterHandle: string): Promise<{ tx: string; userPda: PublicKey }> {
    const handleLower = twitterHandle.toLowerCase().replace('@', '');

    // Derive user account PDA
    const [userPda, userBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('user'),
        Buffer.from(handleLower),
        this.masterWalletPda.toBuffer(),
      ],
      PROGRAM_ID
    );

    // Derive user's token account
    const [tokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('token'), userPda.toBuffer()],
      PROGRAM_ID
    );

    const tx = await this.program.methods
      .registerUser(handleLower)
      .accounts({
        masterWallet: this.masterWalletPda,
        userAccount: userPda,
        owner: this.provider.wallet.publicKey,
        userTokenAccount: tokenPda,
        mint: DEVNET_USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { tx, userPda };
  }

  /**
   * Get user's PDA and token account
   */
  getUserAccounts(twitterHandle: string): { userPda: PublicKey; tokenAccount: PublicKey } {
    const handleLower = twitterHandle.toLowerCase().replace('@', '');

    const [userPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('user'),
        Buffer.from(handleLower),
        this.masterWalletPda.toBuffer(),
      ],
      PROGRAM_ID
    );

    const [tokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('token'), userPda.toBuffer()],
      PROGRAM_ID
    );

    return { userPda, tokenAccount: tokenPda };
  }

  /**
   * Deposit USDC into user's account
   */
  async deposit(twitterHandle: string, amount: number): Promise<string> {
    const { userPda, tokenAccount: userTokenAccount } = this.getUserAccounts(twitterHandle);

    // Get depositor's USDC token account
    const depositorTokenAccount = await getAssociatedTokenAddress(
      DEVNET_USDC_MINT,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .deposit(new BN(amount * 1e6)) // USDC has 6 decimals
      .accounts({
        masterWallet: this.masterWalletPda,
        userAccount: userPda,
        depositor: this.provider.wallet.publicKey,
        depositorTokenAccount,
        userTokenAccount,
        mint: DEVNET_USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Tip another user
   */
  async tip(
    senderHandle: string,
    recipientHandle: string,
    amount: number
  ): Promise<string> {
    const sender = this.getUserAccounts(senderHandle);
    const recipient = this.getUserAccounts(recipientHandle);

    const tx = await this.program.methods
      .tip(new BN(amount * 1e6), recipientHandle.toLowerCase().replace('@', ''))
      .accounts({
        masterWallet: this.masterWalletPda,
        senderUserAccount: sender.userPda,
        recipientUserAccount: recipient.userPda,
        senderTokenAccount: sender.tokenAccount,
        recipientTokenAccount: recipient.tokenAccount,
        mint: DEVNET_USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Withdraw USDC to external wallet
   */
  async withdraw(
    twitterHandle: string,
    amount: number,
    recipientAddress: PublicKey
  ): Promise<string> {
    const { userPda, tokenAccount: userTokenAccount } = this.getUserAccounts(twitterHandle);

    const recipientTokenAccount = await getAssociatedTokenAddress(
      DEVNET_USDC_MINT,
      recipientAddress
    );

    const tx = await this.program.methods
      .withdraw(new BN(amount * 1e6))
      .accounts({
        masterWallet: this.masterWalletPda,
        userAccount: userPda,
        owner: this.provider.wallet.publicKey,
        userTokenAccount,
        recipientTokenAccount,
        recipient: recipientAddress,
        mint: DEVNET_USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Tip to escrow for unregistered user
   */
  async tipToEscrow(
    senderHandle: string,
    recipientHandle: string,
    amount: number
  ): Promise<string> {
    const sender = this.getUserAccounts(senderHandle);
    const handleLower = recipientHandle.toLowerCase().replace('@', '');

    // Derive escrow PDA
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('escrow'),
        Buffer.from(handleLower),
        this.masterWalletPda.toBuffer(),
      ],
      PROGRAM_ID
    );

    // Derive escrow token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      DEVNET_USDC_MINT,
      escrowPda,
      true // allowOwnerOffCurve
    );

    const tx = await this.program.methods
      .tipToEscrow(new BN(amount * 1e6), handleLower)
      .accounts({
        masterWallet: this.masterWalletPda,
        senderUserAccount: sender.userPda,
        escrowAccount: escrowPda,
        sender: this.provider.wallet.publicKey,
        senderTokenAccount: sender.tokenAccount,
        escrowTokenAccount,
        mint: DEVNET_USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return tx;
  }

  /**
   * Get escrow amount for unregistered user
   */
  async getEscrowBalance(twitterHandle: string): Promise<number> {
    const handleLower = twitterHandle.toLowerCase().replace('@', '');

    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('escrow'),
        Buffer.from(handleLower),
        this.masterWalletPda.toBuffer(),
      ],
      PROGRAM_ID
    );

    try {
      const escrowAccount = await this.program.account.escrowAccount.fetch(escrowPda);
      return escrowAccount.amount.toNumber() / 1e6;
    } catch (e) {
      return 0; // No escrow
    }
  }

  /**
   * Get user's on-chain balance
   */
  async getBalance(twitterHandle: string): Promise<{ balance: number; escrowBalance: number }> {
    const { userPda } = this.getUserAccounts(twitterHandle);

    try {
      const userAccount = await this.program.account.userAccount.fetch(userPda);
      return {
        balance: userAccount.balance.toNumber() / 1e6,
        escrowBalance: userAccount.escrowBalance.toNumber() / 1e6,
      };
    } catch (e) {
      return { balance: 0, escrowBalance: 0 }; // User not registered
    }
  }
}
