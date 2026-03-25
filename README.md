# 🎲 Discord Roll Bot

A Discord bot that lets users roll a random number between 1–500 and tracks how many times they've hit **69** or **420**.

---

## Commands

| Command | Description |
|---|---|
| `;roll69` | Roll a random number (1–500). Tracks 69 and 420 hits. |
| `;roll69ldr` | Show the leaderboard of all users and their 69/420 hit counts. |

---

## Setup

### 1. Create a Discord Bot

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → give it a name → go to the **Bot** tab
3. Click **Reset Token** and copy your token — you'll need it shortly
4. Under **Privileged Gateway Intents**, enable:
   - ✅ **Message Content Intent**
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`, `View Channels`
6. Copy the generated URL and open it to invite the bot to your server

### 2. Install & Run

```bash
# Install dependencies
npm install

# Set your bot token as an environment variable
# On Linux/macOS:
export DISCORD_TOKEN=your_token_here

# On Windows (Command Prompt):
set DISCORD_TOKEN=your_token_here

# On Windows (PowerShell):
$env:DISCORD_TOKEN="your_token_here"

# Start the bot
npm start
```

### 3. Persistent Storage

Roll data is saved to `roll_data.json` in the same directory. This file is created automatically on first use and persists between restarts.

---

## How It Works

- Each `;roll69` generates a random integer from **1 to 500**
- If the result is **69** or **420**, it's counted as a special hit for that user
- Stats (69 hits, 420 hits, total rolls) are shown after every roll
- `;roll69ldr` displays a leaderboard sorted by total special hits
