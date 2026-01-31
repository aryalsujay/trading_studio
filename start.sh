#!/bin/bash

# Ensure we are in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if node_modules exists, if not, install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 First time run detected. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: npm install failed."
        exit 1
    fi
    echo "✅ Dependencies installed successfully."
fi

# Start the application
echo "🚀 Starting ETF Trading Ledger..."
npm start
