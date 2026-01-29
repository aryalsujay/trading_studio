# 📊 ETF Trading Ledger

A modern, local web application for tracking ETF delivery equity trades with accurate Zerodha brokerage calculations and profit/loss tracking.

## ✨ Features

- **📈 Dashboard**: Real-time P&L summary, win rate, and performance metrics
- **💼 Trades Management**: Full CRUD operations for recording buy/sell trades
- **💰 Capital Tracking**: Manage deposits and withdrawals
- **🧮 Brokerage Calculator**: Exact Zerodha formula for delivery equity
- **🎨 Premium UI**: Dark theme with glassmorphism and smooth animations
- **🔒 Local First**: All data stored locally in SQLite database

## 🚀 Quick Start (Mac)

### Prerequisites

- Node.js 18+ (check with `node --version`)
- npm (comes with Node.js)

### Installation

1. **Install dependencies:**
   ```bash
   cd /Users/sujay/etf
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

   This will start both the backend API (port 3000) and frontend (port 5173).

3. **Open in browser:**
   ```
   http://localhost:5173
   ```

### Separate Commands

If you want to run frontend and backend separately:

```bash
# Terminal 1: Start backend API
npm run server

# Terminal 2: Start frontend dev server
npm run dev
```

## 📁 Project Structure

```
/Users/sujay/etf/
├── db/
│   ├── schema.sql          # Database schema
│   └── trading.db          # SQLite database (auto-created)
├── server/
│   ├── server.js           # Express API server
│   ├── database.js         # Database connection
│   └── utils/
│       └── brokerageCalculator.js  # Zerodha formula
├── src/
│   ├── components/         # React components
│   │   ├── Dashboard.jsx
│   │   ├── TradesPage.jsx
│   │   ├── CapitalPage.jsx
│   │   └── BrokerageCalculator.jsx
│   ├── styles/
│   │   └── index.css       # Premium dark theme
│   ├── App.jsx             # Main app component
│   ├── main.jsx           # React entry point
│   ├── api.js              # API helper functions
│   └── utils.js            # Formatting utilities
├── index.html
├── package.json
└── vite.config.js
```

## 💡 Usage

### Adding a Trade

1. Go to **Trades** page
2. Click **+ Add Trade**
3. Enter trade details:
   - Symbol (e.g., NIFTYBEES)
   - Trade date
   - Buy price
   - Sell price
   - Quantity
4. Brokerage is **automatically calculated** using Zerodha formula
5. Click **Add Trade**

### Managing Capital

1. Go to **Capital** page
2. Click **+ Add Transaction**
3. Choose type (Deposit/Withdrawal)
4. Enter amount and date
5. Click **Add**

### Using the Calculator

1. Go to **Calculator** page
2. Enter buy price, sell price, and quantity
3. Click **Calculate**
4. View detailed brokerage breakdown and net P/L

## 🧮 Brokerage Formula

This app uses the **exact Zerodha formula** for delivery equity:

- **STT**: 0.1% on both buy & sell (rounded to ₹1)
- **Exchange Transaction**: ~0.0000307 (rounded to 2 decimals)
- **SEBI**: ₹10 per crore (rounded to 2 decimals)
- **Stamp Duty**: 0.015% on buy only (rounded to ₹1)
- **GST**: 18% on (transaction + SEBI + brokerage) (rounded to 2 decimals)
- **Brokerage**: ₹0 for delivery

The formula exactly matches what Zerodha displays, including all rounding rules.

## 🗄️ Database

Data is stored in SQLite at: `/Users/sujay/etf/db/trading.db`

The database includes:
- Members (currently 1 member, extensible)
- Capital transactions
- Trades with instrument types
- Profit distributions (for future multi-member support)

## 🌐 Future Deployment (Hostinger)

When ready to deploy to Hosting:

1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Upload the `dist/` folder and `server/` folder to Hostinger

3. Set up Node.js app on Hostinger pointing to `server/server.js`

4. Configure environment variables as needed

## 🔧 Troubleshooting

**Port already in use:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill

# Or use different port by editing server/server.js
```

**Database issues:**
```bash
# Reset database
rm db/trading.db
npm run server  # Will recreate from schema
```

## 📝 Notes

- **Formula Accuracy**: The brokerage calculator uses the exact formula from your Google Sheets script
- **Data Safety**: All data is stored locally in SQLite
- **Scalability**: Database schema supports multiple members and instrument types (F&O, Commodity) for future expansion
- **MVP Scope**: Currently optimized for single member and delivery equity only

## 📞 Support

For issues or questions, refer to the implementation plan in `.gemini/antigravity/brain/` directory.

---

**Built with**: React, Vite, Express, SQLite  
**License**: Private  
**Version**: 1.0.0
