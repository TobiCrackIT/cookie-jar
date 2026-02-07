#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo");

#[program]
pub mod tipbot {
    use super::*;

    /// Initialize the master wallet
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let master_wallet = &mut ctx.accounts.master_wallet;
        master_wallet.authority = ctx.accounts.authority.key();
        master_wallet.total_users = 0;
        master_wallet.total_escrows = 0;
        master_wallet.bump = ctx.bumps.master_wallet;
        Ok(())
    }

    /// Register a new user with their Twitter handle
    pub fn register_user(ctx: Context<RegisterUser>, twitter_handle: String) -> Result<()> {
        require!(twitter_handle.len() <= 32, TipBotError::HandleTooLong);

        let master_wallet = &mut ctx.accounts.master_wallet;
        master_wallet.total_users = master_wallet
            .total_users
            .checked_add(1)
            .ok_or(TipBotError::MathOverflow)?;

        let user_account = &mut ctx.accounts.user_account;
        user_account.twitter_handle = twitter_handle.clone();
        user_account.owner = ctx.accounts.owner.key();
        user_account.balance = 0;
        user_account.escrow_balance = 0;
        user_account.bump = ctx.bumps.user_account;

        let escrow_account = &mut ctx.accounts.escrow_account;
        if escrow_account.recipient_twitter_handle.is_empty() {
            escrow_account.recipient_twitter_handle = twitter_handle.clone();
        } else {
            require!(
                escrow_account.recipient_twitter_handle == twitter_handle,
                TipBotError::EscrowHandleMismatch
            );
        }
        escrow_account.bump = ctx.bumps.escrow_account;

        let expected_escrow_ata = anchor_spl::associated_token::get_associated_token_address(
            &escrow_account.key(),
            &ctx.accounts.mint.key(),
        );
        require!(
            expected_escrow_ata == ctx.accounts.escrow_token_account.key(),
            TipBotError::InvalidEscrowTokenAccount
        );

        // Create token account for this user
        let cpi_accounts = anchor_spl::associated_token::Create {
            payer: ctx.accounts.owner.to_account_info(),
            associated_token: ctx.accounts.user_token_account.to_account_info(),
            authority: master_wallet.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            cpi_accounts,
        );
        anchor_spl::associated_token::create(cpi_ctx)?;

        // Check if there's an existing escrow and claim it
        let escrow_amount = escrow_account.amount;
        if escrow_amount > 0 {
            // Transfer from escrow to user
            let master_key = master_wallet.key();
            let escrow_seeds = &[
                b"escrow",
                twitter_handle.as_bytes(),
                master_key.as_ref(),
                &[escrow_account.bump],
            ];
            let escrow_signer = &[&escrow_seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: escrow_account.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                escrow_signer,
            );
            token::transfer(cpi_ctx, escrow_amount)?;

            // Update balances
            user_account.balance = escrow_amount;
            user_account.escrow_balance = escrow_amount;

            // Reset escrow
            escrow_account.amount = 0;
        }

        Ok(())
    }

    /// Deposit USDC into user's account
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update user's balance record
        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = user_account
            .balance
            .checked_add(amount)
            .ok_or(TipBotError::MathOverflow)?;

        Ok(())
    }

    /// Tip another registered user (transfer between accounts)
    pub fn tip(ctx: Context<Tip>, amount: u64, recipient_twitter_handle: String) -> Result<()> {
        require!(amount > 0, TipBotError::InvalidAmount);

        require!(
            ctx.accounts.recipient_user_account.twitter_handle == recipient_twitter_handle,
            TipBotError::EscrowHandleMismatch
        );

        let sender_balance = ctx.accounts.sender_user_account.balance;
        require!(sender_balance >= amount, TipBotError::InsufficientBalance);

        // Update balances
        let sender_account = &mut ctx.accounts.sender_user_account;
        sender_account.balance = sender_balance
            .checked_sub(amount)
            .ok_or(TipBotError::MathOverflow)?;

        let recipient_account = &mut ctx.accounts.recipient_user_account;
        recipient_account.balance = recipient_account
            .balance
            .checked_add(amount)
            .ok_or(TipBotError::MathOverflow)?;

        // Transfer tokens on-chain
        let master_wallet_key = ctx.accounts.master_wallet.key();
        let seeds = &[
            b"master_wallet",
            master_wallet_key.as_ref(),
            &[ctx.accounts.master_wallet.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.master_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    /// Tip to escrow for unregistered user
    pub fn tip_to_escrow(
        ctx: Context<TipToEscrow>,
        amount: u64,
        recipient_twitter_handle: String,
    ) -> Result<()> {
        require!(amount > 0, TipBotError::InvalidAmount);

        let sender_balance = ctx.accounts.sender_user_account.balance;
        require!(sender_balance >= amount, TipBotError::InsufficientBalance);

        // Update sender balance
        let sender_account = &mut ctx.accounts.sender_user_account;
        sender_account.balance = sender_balance
            .checked_sub(amount)
            .ok_or(TipBotError::MathOverflow)?;

        let escrow = &mut ctx.accounts.escrow_account;
        if escrow.recipient_twitter_handle.is_empty() {
            escrow.recipient_twitter_handle = recipient_twitter_handle.clone();
        } else {
            require!(
                escrow.recipient_twitter_handle == recipient_twitter_handle,
                TipBotError::EscrowHandleMismatch
            );
        }
        escrow.bump = ctx.bumps.escrow_account;

        let expected_escrow_ata = anchor_spl::associated_token::get_associated_token_address(
            &escrow.key(),
            &ctx.accounts.mint.key(),
        );
        require!(
            expected_escrow_ata == ctx.accounts.escrow_token_account.key(),
            TipBotError::InvalidEscrowTokenAccount
        );

        // Update escrow balance
        escrow.amount = escrow
            .amount
            .checked_add(amount)
            .ok_or(TipBotError::MathOverflow)?;

        let master_wallet = &mut ctx.accounts.master_wallet;
        let master_wallet_key = master_wallet.key();
        let seeds = &[
            b"master_wallet",
            master_wallet_key.as_ref(),
            &[master_wallet.bump],
        ];
        let signer = &[&seeds[..]];

        // Create escrow token account if needed
        if ctx.accounts.escrow_token_account.data_is_empty() {
            let cpi_accounts = anchor_spl::associated_token::Create {
                payer: ctx.accounts.sender.to_account_info(),
                associated_token: ctx.accounts.escrow_token_account.to_account_info(),
                authority: escrow.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                cpi_accounts,
            );
            anchor_spl::associated_token::create(cpi_ctx)?;
        }

        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: master_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        // Update master wallet stats
        master_wallet.total_escrows = master_wallet
            .total_escrows
            .checked_add(1)
            .ok_or(TipBotError::MathOverflow)?;

        Ok(())
    }

    /// Withdraw USDC to external wallet
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, TipBotError::InvalidAmount);

        let user_balance = ctx.accounts.user_account.balance;
        require!(user_balance >= amount, TipBotError::InsufficientBalance);

        // Update balance
        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = user_balance
            .checked_sub(amount)
            .ok_or(TipBotError::MathOverflow)?;

        // Transfer tokens
        let master_wallet_key = ctx.accounts.master_wallet.key();
        let seeds = &[
            b"master_wallet",
            master_wallet_key.as_ref(),
            &[ctx.accounts.master_wallet.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.master_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MasterWallet::SIZE,
        seeds = [b"master_wallet", authority.key().as_ref()],
        bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(twitter_handle: String)]
pub struct RegisterUser<'info> {
    #[account(
        mut,
        seeds = [b"master_wallet", master_wallet.authority.as_ref()],
        bump = master_wallet.bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserAccount::SIZE,
        seeds = [b"user", twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: This will be created by the program
    #[account(
        mut,
        seeds = [b"token", user_account.key().as_ref()],
        bump
    )]
    pub user_token_account: UncheckedAccount<'info>,
    /// CHECK: Escrow account if exists
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    /// CHECK: Escrow token account
    #[account(mut)]
    pub escrow_token_account: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"master_wallet", master_wallet.authority.as_ref()],
        bump = master_wallet.bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(
        mut,
        seeds = [b"user", user_account.twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = depositor
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = master_wallet
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64, recipient_twitter_handle: String)]
pub struct Tip<'info> {
    #[account(
        mut,
        seeds = [b"master_wallet", master_wallet.authority.as_ref()],
        bump = master_wallet.bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(
        mut,
        seeds = [b"user", sender_user_account.twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump = sender_user_account.bump
    )]
    pub sender_user_account: Account<'info, UserAccount>,
    #[account(
        mut,
        seeds = [b"user", recipient_twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump = recipient_user_account.bump
    )]
    pub recipient_user_account: Account<'info, UserAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = master_wallet
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = master_wallet
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64, recipient_twitter_handle: String)]
pub struct TipToEscrow<'info> {
    #[account(
        mut,
        seeds = [b"master_wallet", master_wallet.authority.as_ref()],
        bump = master_wallet.bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(
        mut,
        seeds = [b"user", sender_user_account.twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump = sender_user_account.bump
    )]
    pub sender_user_account: Account<'info, UserAccount>,
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", recipient_twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = master_wallet
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    /// CHECK: Escrow token account, validated in instruction
    #[account(mut)]
    pub escrow_token_account: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"master_wallet", master_wallet.authority.as_ref()],
        bump = master_wallet.bump
    )]
    pub master_wallet: Account<'info, MasterWallet>,
    #[account(
        mut,
        seeds = [b"user", user_account.twitter_handle.as_bytes(), master_wallet.key().as_ref()],
        bump = user_account.bump,
        has_one = owner
    )]
    pub user_account: Account<'info, UserAccount>,
    pub owner: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = master_wallet
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is the external wallet to withdraw to
    pub recipient: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct MasterWallet {
    pub authority: Pubkey,
    pub total_users: u64,
    pub total_escrows: u64,
    pub bump: u8,
}

impl MasterWallet {
    pub const SIZE: usize = 32 + 8 + 8 + 1;
}

#[account]
pub struct UserAccount {
    pub twitter_handle: String, // 4 + 32 bytes max
    pub owner: Pubkey,          // 32 bytes
    pub balance: u64,           // 8 bytes
    pub escrow_balance: u64,    // 8 bytes
    pub bump: u8,               // 1 byte
}

impl UserAccount {
    pub const SIZE: usize = 4 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct EscrowAccount {
    pub recipient_twitter_handle: String, // 4 + 32 bytes
    pub amount: u64,                      // 8 bytes
    pub bump: u8,                         // 1 byte
}

impl EscrowAccount {
    pub const SIZE: usize = 4 + 32 + 8 + 1;
}

#[error_code]
pub enum TipBotError {
    #[msg("Twitter handle too long")]
    HandleTooLong,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Escrow handle mismatch")]
    EscrowHandleMismatch,
    #[msg("Invalid escrow token account")]
    InvalidEscrowTokenAccount,
    #[msg("Math overflow")]
    MathOverflow,
}
