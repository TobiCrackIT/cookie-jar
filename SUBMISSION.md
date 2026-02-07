# 🏆 Colosseum Hackathon Submission

## Project: TipBot

---

## 📋 Quick Facts

| Field | Value |
|-------|-------|
| **Project Name** | TipBot 🍪 |
| **Tagline** | Send USDC tips via Twitter mentions on Solana |
| **Project ID** | 420 |
| **Track** | Solana Agent |
| **Team Size** | 1 |
| **Submission Date** | February 2026 |
| **GitHub Repo** | https://github.com/TobiCrackIT/cookie-jar |

---

## 🎯 Elevator Pitch

**TipBot** is a Twitter bot that makes sending crypto tips as easy as tweeting. Users DM "register" to get an auto-generated Solana wallet, then send tips by mentioning the bot in tweets. Built for the Colosseum Hackathon, it removes all crypto complexity while maintaining full on-chain transparency.

**In one sentence**: "Venmo for Twitter, built on Solana."

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Auto-Generated Wallets** | Users DM "register" → instant wallet creation, no crypto knowledge needed |
| **Tweet-to-Tip** | Send tips via Twitter mentions: `@cookkiiee_bot tip @user 5 USDC` |
| **Escrow System** | Tips to unregistered users go to escrow, auto-claimed on registration |
| **Custodial UX** | Bot holds keys for seamless experience, users can withdraw anytime |
| **On-Chain** | All transactions recorded on Solana devnet, fully transparent |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Solana Devnet |
| **Smart Contract** | Rust + Anchor Framework |
| **Backend** | TypeScript + Node.js |
| **API** | Twitter API v2 |
| **Client** | Anchor TS + @solana/web3.js |
| **Wallet** | Bot-generated keypairs (custodial) |

---

## 📦 Smart Contract Details

| Property | Value |
|----------|-------|
| **Program ID** | `JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo` |
| **Master Wallet** | `DAvMipMcnbWStsXSontrn54hVxSwSfKBDzH6Cmco9fsv` |
| **Network** | Solana Devnet |
| **Deployments** | 1 (active) |

### Instructions Implemented
- ✅ `initialize` - Master wallet setup
- ✅ `register_user` - User onboarding
- ✅ `deposit` - Fund accounts
- ✅ `tip` - P2P transfers
- ✅ `tip_to_escrow` - Escrow for unregistered users
- ✅ `withdraw` - External withdrawals

---

## 🎬 Demo Assets

| Asset | Link | Status |
|-------|------|--------|
| **Live Demo Page** | [demo.html](demo.html) | ✅ Complete |
| **Video Script** | [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | ✅ Complete |
| **Full README** | [README_HACKATHON.md](README_HACKATHON.md) | ✅ Complete |
| **Architecture Diagram** | See README_HACKATHON.md | ✅ Complete |

### Live Demo
Open `demo.html` in any browser to see an interactive simulation of:
- Registration flow
- Balance checking
- Sending tips
- Escrow mechanism
- Withdrawal process

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| **GitHub Repository** | https://github.com/TobiCrackIT/cookie-jar |
| **Program on Solscan** | https://solscan.io/account/JDj9z4vXUj46cRX4UmnfLgV2fGNw2Qnjewr5qzgeHrSo?cluster=devnet |
| **Master Wallet** | https://solscan.io/account/DAvMipMcnbWStsXSontrn54hVxSwSfKBDzH6Cmco9fsv?cluster=devnet |
| **Deployment Tx** | https://solscan.io/tx/67FUDSFJ4b3wMSyhjjvFLYAyBAxWJYscHws5QnhFTVggL7tPrPxzJMJrTf19wu6pjLeVo4DRbERDyUbb8EYMnbyk?cluster=devnet |
| **Init Tx** | https://solscan.io/tx/4tttmCzT5F4mckrgSJP2ADVRE8Ar5cRMeX5MNwE81y4eLMP3RKALPn12uSGC9o1RL3ANavZ7DiDVaPVMp8DuRLtE?cluster=devnet |

---

## 🏗️ What We Built

### Smart Contract (Anchor)
- **600+ lines** of Rust code
- **6 instructions** for complete tipping flow
- **3 account types**: MasterWallet, UserAccount, EscrowAccount
- **Security features**: PDA validation, math overflow checks, access control

### Bot Server (TypeScript)
- **Twitter integration** via API v2
- **Command parser** for tip syntax
- **Wallet registry** with JSON persistence
- **On-chain client** using Anchor

### Key Innovations
1. **Custodial Auto-Wallets** - Zero-friction onboarding
2. **Escrow System** - No lost tips for unregistered users
3. **Twitter-Native** - Tipping where conversations happen

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Lines of Code** | ~2,500 (TypeScript + Rust) |
| **Smart Contract Size** | 412 KB |
| **Dependencies** | 30+ npm packages |
| **Test Transactions** | 10+ on devnet |
| **Development Time** | ~3 days |

---

## 🎯 Why Solana?

| Factor | Why It Matters |
|--------|----------------|
| **Low Fees** | <$0.01 per transaction - micro-tips viable |
| **Fast Finality** | ~400ms - instant user experience |
| **Anchor Framework** | Rapid development, type safety |
| **Devnet Faucet** | Free SOL for testing and demos |
| **Ecosystem** | Growing DeFi + SocialFi infrastructure |

---

## 🚀 Future Roadmap

### Phase 1: Hackathon (Current)
- ✅ Devnet deployment
- ✅ Basic tipping flow
- ✅ Escrow mechanism
- ✅ Demo assets

### Phase 2: MVP (Next)
- 🔲 Mainnet deployment
- 🔲 Twitter Basic tier upgrade ($100/mo)
- 🔲 Multi-token support (SOL, USDC, USDT)
- 🔲 Web dashboard for users

### Phase 3: Scale
- 🔲 Non-custodial option (user holds keys)
- 🔲 Mobile app
- 🔲 Group tipping / splits
- 🔲 NFT integration (tip with NFTs)

---

## 🙏 Acknowledgments

- **Solana Foundation** - For the amazing developer ecosystem
- **Anchor Framework** - Making Solana dev accessible
- **Colosseum** - For hosting this hackathon
- **CookieBot** - The AI assistant that helped build this! 🤖

---

## 📞 Contact

| Platform | Handle |
|----------|--------|
| **GitHub** | @TobiCrackIT |
| **Twitter** | @tobillionn |
| **Telegram** | @tobillionn |

---

## ✅ Submission Checklist

- [x] Smart contract deployed to devnet
- [x] GitHub repository created and public
- [x] README with setup instructions
- [x] Demo video script prepared
- [x] Interactive demo page created
- [x] All transaction links documented
- [x] Architecture documented
- [x] Submission form filled

---

*Built with ❤️ for the Solana ecosystem*

**🍪 TipBot - Crypto tipping, finally simple.**
