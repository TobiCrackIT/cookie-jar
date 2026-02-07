# 🍪 TipBot - Hackathon Submission

> **Twitter Tipping Bot on Solana**  
> Send USDC tips via Twitter mentions. No crypto knowledge required!

---

## 🎯 Project Overview

TipBot is a Twitter/X bot that enables instant USDC tipping between users on Solana. Simply mention the bot in a tweet to send a tip to anyone - even if they don't have a crypto wallet yet!

### Key Innovation

**Custodial Auto-Generated Wallets**: Users DM "register" and the bot creates a Solana wallet automatically. This removes the biggest barrier to crypto adoption - wallet setup complexity.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Twitter/X     │────▶│   TipBot Server  │────▶│  Solana Devnet  │
│   Platform      │◀────│   (TypeScript)   │◀────│  Smart Contract │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐           ┌──────────────┐
                        │   Local      │           │  Master      │
                        │   Registry   │           │  Wallet PDA  │
                        │  (JSON file) │           │              │
                        └──────────────┘           └──────────────┘
                                                          │
                               ┌──────────────────────────┼──────────┐
                               ▼                          ▼          ▼
                        ┌──────────┐              ┌──────────┐ ┌──────────┐
                        │  User    │              │  User    │ │  Escrow  │
                        │ Account  │              │  Token   │ │  Account │
                        │   PDA    │              │  Account │ │   PDA    │
                        └──────────┘              └──────────┘ └──────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Smart Contract** | Rust + Anchor | On-chain program for custodial wallets |
| **Bot Server** | TypeScript + Node.js | Twitter API integration, command processing |
| **Registry** | Local JSON file | Maps Twitter handles to wallet addresses |
| **Client** | Anchor TS Client | Solana transaction building |

---

## ✨ Features

### 1. Auto-Generated Wallets
- User DMs "register" → Bot creates wallet instantly
- No seed phrases, no downloads, no crypto knowledge needed
- Custodial model for seamless UX

### 2. Tip via Twitter Mentions
```
@cookkiiee_bot tip @username 5 USDC
```

### 3. Escrow System
- Tips to unregistered users go to escrow
- Auto-claimed when they register
- No funds lost!

### 4. Full Custodial Management
- Deposit USDC
- Send tips
- Withdraw to external wallets

---

## 🚀 Smart Contract (Deployed on Devnet)

| Detail | Value |
|--------|-------|
| **Program ID** | `JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo` |
| **Master Wallet** | `DAvMipMcnbWStsXSontrn54hVxSwSfKBDzH6Cmco9fsv` |
| **Network** | Solana Devnet |
| **Language** | Rust + Anchor Framework |

### Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create master wallet (one-time setup) |
| `register_user` | Create user account with auto-generated wallet |
| `deposit` | Deposit USDC into user's account |
| `tip` | Transfer USDC between registered users |
| `tip_to_escrow` | Send tip to unregistered user (escrow) |
| `withdraw` | Withdraw USDC to external wallet |

### Accounts

| Account | Purpose |
|---------|---------|
| `MasterWallet` | Central authority, tracks stats |
| `UserAccount` | Per-user data: handle, balance, owner |
| `EscrowAccount` | Holds tips for unregistered users |

---

## 🎬 Demo Video Script (60 seconds)

### Scene 1: The Problem (0:00-0:10)
**Visual**: Split screen showing complex wallet setup vs. simple Twitter
**Voiceover**: "Sending crypto to friends is hard. Wallets, seed phrases, gas fees... What if it was as easy as a tweet?"

### Scene 2: Registration (0:10-0:20)
**Visual**: Twitter DM conversation
**Voiceover**: "Just DM 'register' to TipBot and your wallet is created instantly."
**On-screen**: 
```
User: register
Bot: ✅ Wallet created! Address: 5cEsw...
```

### Scene 3: Sending a Tip (0:20-0:35)
**Visual**: Tweet composition
**Voiceover**: "To tip someone, just mention the bot in a tweet."
**On-screen**: `@cookkiiee_bot tip @alice 5 USDC`

### Scene 4: Receiving Tips (0:35-0:45)
**Visual**: DM notification + Solscan transaction
**Voiceover**: "They get the tip instantly, even if they haven't registered yet. Funds wait in escrow."

### Scene 5: Withdrawal (0:45-0:55)
**Visual**: DM conversation
**Voiceover**: "Withdraw to any wallet anytime. Your funds, your control."
**On-screen**: `withdraw 10 7dthirg...`

### Scene 6: Call to Action (0:55-1:00)
**Visual**: GitHub repo + Program ID
**Voiceover**: "TipBot. Crypto tipping, finally simple. Built on Solana."

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- Solana CLI (for devnet)
- Twitter Developer Account (for API keys)

### Installation

```bash
# Clone repository
git clone https://github.com/TobiCrackIT/cookie-jar.git
cd cookie-jar

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Build
npm run build

# Run
npm start
```

### Environment Variables

```env
# Twitter API
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_secret

# Bot Wallet (generated)
BOT_PRIVATE_KEY=[...]

# Solana
SOLANA_NETWORK=devnet
```

---

## 📸 Screenshots

### Registration Flow
![Registration](screenshots/registration.png)

### Tip Transaction
![Tip](screenshots/tip.png)

### Solscan Verification
![Solscan](screenshots/solscan.png)

---

## 🧪 Testing

```bash
# Test registration
node scripts/testRegistration.js

# Check program deployment
solana program show JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo --url devnet
```

---

## 🏆 Hackathon Details

| Field | Value |
|-------|-------|
| **Event** | Colosseum $100k Agent Hackathon |
| **Project ID** | 420 |
| **Track** | Solana Agent |
| **Team Size** | 1 (Solo) |
| **Submission Date** | Feb 2026 |

### Team

| Role | Name | GitHub |
|------|------|--------|
| Developer | Oluwatobi | @TobiCrackIT |

---

## 🔗 Links

- **Live Demo**: [demo.html](demo.html) (open in browser)
- **GitHub Repo**: https://github.com/TobiCrackIT/cookie-jar
- **Program on Solscan**: https://solscan.io/account/JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo?cluster=devnet
- **Master Wallet**: https://solscan.io/account/DAvMipMcnbWStsXSontrn54hVxSwSfKBDzH6Cmco9fsv?cluster=devnet

---

## 📝 Notes for Judges

### What Works
- ✅ Smart contract deployed on Solana devnet
- ✅ Auto-generated wallet creation
- ✅ On-chain registration flow
- ✅ Bot architecture and command parsing
- ✅ Escrow mechanism (code complete)

### Known Limitations
- ⚠️ Twitter API requires Basic tier ($100/mo) for posting
- ⚠️ Demo uses custodial wallets (acceptable for hackathon)
- ⚠️ Currently on devnet only

### Future Improvements
- Multi-signature wallet upgrade
- Support for SOL tips in addition to USDC
- Webhook-based Twitter streaming
- Mainnet deployment with proper security audit

---

## 📄 License

MIT License - Feel free to fork and build upon!

---

*Built with ❤️ for the Solana ecosystem*
