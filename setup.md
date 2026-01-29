# 🚀 ETF Trading Ledger - Local Setup Guide

Follow these simple steps to set up and run the **ETF Trading Ledger** system on your local machine.

## 📋 Prerequisites
Ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

---

## 🛠️ Installation Steps

### 1. Clone/Download the Code
If you have the code folder, open your terminal (Command Prompt, PowerShell, or Terminal on Mac) and navigate to the project directory:

```sh
cd /path/to/etf-trading-ledger
```

### 2. Install Dependencies
Run the following command to download all necessary libraries:

```sh
npm install
```
*This may take a minute or two.*

### 3. Initialize the Database
Set up the local SQLite database (`etf-ledger.db`) by running:

```sh
npm run setup
```
*You should see a message confirming the database has been initialized.*

---

## ▶️ Running the Application

### Start the System
To run both the **Backend Server** and the **Frontend UI** simultaneously, simply run:

```sh
npm start
```

### Access the Application
Once the system starts, open your browser and go to:
- **Dashboard:** [http://localhost:5173](http://localhost:5173)

---

## 🔄 Common Commands

| Command | Description |
| :--- | :--- |
| `npm start` | **Starts the full system** (Frontend + Backend) |
| `npm run dev` | Starts only the Frontend (UI) |
| `npm run server` | Starts only the Backend (API) |
| `npm run setup` | Re-initializes the database (Use with caution if you have data!) |

## ❓ Troubleshooting

- **Port in use error?**
  If you see an error saying port `3000` or `5173` is busy, stop any other running instances (Ctrl+C) or check if another app is using these ports.
- **"Failed to delete member" or API errors?**
  Ensure the backend server is actually running. If you are running `npm run dev` only, the backend won't start. Use `npm start`.

---
**Enjoy Managing Your Trades! 📈**
