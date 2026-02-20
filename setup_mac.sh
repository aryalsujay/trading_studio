#!/bin/bash
set -e

echo "=========================================="
echo "🚀 ETF Trading Ledger - iMac Setup"
echo "=========================================="

# 1. Install Homebrew (Mac Package Manager) if missing
if ! command -v brew &> /dev/null; then
    echo "🍺 Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Ensure it's in path for Apple Silicon (M1/M2/M3) Macs
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew is already installed."
fi

# 2. Install Node.js via Homebrew
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing Node.js..."
    brew install node
else
    echo "✅ Node.js is already installed ($(node -v))."
fi

# 3. Setup the Project
echo "📥 Installing required NPM packages (Vite, React, Express, SQLite)..."
npm install

echo "🗄️ Initializing Local SQLite Database..."
npm run setup

echo ""
echo "=========================================="
echo "✨ SETUP COMPLETE! ✨"
echo "=========================================="
echo "To run the app anytime in the future, just double-click 'start.sh' or run:"
echo "  ./start.sh"
echo ""

# Ask to start immediately
read -p "Would you like to start the application now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    chmod +x start.sh
    ./start.sh
fi
