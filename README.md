# 🍪 TipBot - Solana Tipping via Twitter/X

A Twitter/X bot that enables instant micropayments and tipping on Solana. Users can tip each other by simply tweeting:

```
@cookkiiee_bot tip @username 0.005 USDC
```

Powered by **x402** for infrastructure costs and **Solana** for sub-second settlement.

## 🎯 Hackathon Submission

- **Event:** Colosseum Agent Hackathon
- **Track:** Payments + Consumer + AI
- **Prize Pool:** $100,000 USDC

## 🚀 Features

- ✅ **Natural Language Tips** — Tweet to tip, no app needed
- ✅ **Instant Settlement** — Sub-second confirmation on Solana
- ✅ **USDC & SOL Support** — Tip in stablecoins or native SOL
- ✅ **x402 Integration** — Micropayments for API costs
- ✅ **AgentWallet** — Secure, policy-controlled transactions

## 🛠️ Architecture

```
Twitter Mention → Parse Command → Verify Balance → Execute Transfer → Reply
```

| Component | Technology |
|-----------|------------|
| **Input** | Twitter API v2 |
| **Parser** | Natural language command extraction |
| **Wallet** | AgentWallet (Solana + EVM) |
| **Blockchain** | Solana (devnet → mainnet) |
| **Payments** | x402 protocol for API costs |
| **RPC** | Helius enhanced API |

## 📋 Commands

### Public (Tweets)
```
@cookkiiee_bot tip @username 0.01 USDC
@cookkiiee_bot tip @username 0.5 SOL
```

### DM Commands
```
register <solana_address>  → Link your wallet
balance                     → Check your balance
```

## 🏗️ Project Structure

```
tipbot/
├── src/
│   ├── parser/          # Command parsing
│   ├── twitter/         # Twitter API integration
│   ├── solana/          # Transfer execution
│   ├── registry/        # Handle-to-wallet mapping
│   └── index.ts         # Entry point
├── data/                # Wallet registry storage
├── package.json
└── .env                 # Configuration
```

## ⚡ Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run the bot
```bash
npm run dev
```

## 🔐 Environment Variables

| Variable | Description |
|----------|-------------|
| `TWITTER_API_KEY` | Twitter API key |
| `TWITTER_API_SECRET` | Twitter API secret |
| `TWITTER_ACCESS_TOKEN` | Twitter access token |
| `TWITTER_ACCESS_SECRET` | Twitter access secret |
| `AGENTWALLET_API_TOKEN` | AgentWallet API token |
| `AGENTWALLET_USERNAME` | AgentWallet username |
| `HELIUS_API_KEY` | Helius RPC API key |

## 🧪 Testing

```bash
npm test
```

## 📝 License

MIT

## 🤝 Team

- **Oluwatobi** — Idea & Product
- **CookieBot** — Agent Developer

---

Built for the Colosseum Agent Hackathon 2026 🚀
