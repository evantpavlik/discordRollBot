const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_FILE = './roll_data.json';

// Load or initialize persistent data
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return {};
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Returns a random int between 1 and 500 (inclusive)
function rollDice() {
  return Math.floor(Math.random() * 500) + 1;
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  // ─── ;roll69 ────────────────────────────────────────────────────────────────
  if (content === ';roll69') {
    const result = rollDice();
    const userId = message.author.id;
    const username = message.author.username;

    const data = loadData();

    // Initialize user record if needed
    if (!data[userId]) {
      data[userId] = { username, hits69: 0, hits420: 0, totalRolls: 0 };
    }

    // Always update display name in case it changed
    data[userId].username = username;
    data[userId].totalRolls += 1;

    const isSpecial69 = result === 69;
    const isSpecial420 = result === 420;

    if (isSpecial69) data[userId].hits69 += 1;
    if (isSpecial420) data[userId].hits420 += 1;

    saveData(data);

    // Build the embed
    const embed = new EmbedBuilder()
      .setColor(isSpecial69 || isSpecial420 ? '#FFD700' : '#5865F2')
      .setTitle(isSpecial69 ? '🎉 NICE — 69!' : isSpecial420 ? '🌿 BLAZE IT — 420!' : '🎲 Roll Result')
      .setDescription(
        `**${message.author.username}** rolled a **${result}**!`
      )
      .addFields(
        { name: '69 Hits', value: `${data[userId].hits69}`, inline: true },
        { name: '420 Hits', value: `${data[userId].hits420}`, inline: true },
        { name: 'Total Rolls', value: `${data[userId].totalRolls}`, inline: true }
      )
      .setFooter({ text: 'Range: 1–500 • Use ;roll69ldr for the leaderboard' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── ;roll69ldr ──────────────────────────────────────────────────────────────
  if (content === ';roll69ldr') {
    const data = loadData();
    const users = Object.values(data);

    if (users.length === 0) {
      await message.reply('No rolls have been recorded yet! Use `;roll69` to start.');
      return;
    }

    // Sort by total special hits (69 + 420), then by 69s, then by 420s
    users.sort((a, b) => {
      const totalA = a.hits69 + a.hits420;
      const totalB = b.hits69 + b.hits420;
      if (totalB !== totalA) return totalB - totalA;
      if (b.hits69 !== a.hits69) return b.hits69 - a.hits69;
      return b.hits420 - a.hits420;
    });

    const medals = ['🥇', '🥈', '🥉'];

    const leaderboardLines = users.map((u, i) => {
      const medal = medals[i] ?? `**#${i + 1}**`;
      const specialHits = u.hits69 + u.hits420;
      return (
        `${medal} **${u.username}**\n` +
        `　🔢 69 hits: **${u.hits69}** • 420 hits: **${u.hits420}** • Total specials: **${specialHits}**\n` +
        `　🎲 Total rolls: **${u.totalRolls}**`
      );
    });

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Roll Leaderboard — 69 & 420 Tracker')
      .setDescription(leaderboardLines.join('\n\n') || 'No data yet.')
      .setFooter({ text: 'Sorted by total 69+420 hits • Use ;roll69 to roll!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }
});

// ─── Start the bot ────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

client.login(TOKEN);
