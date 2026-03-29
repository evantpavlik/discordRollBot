const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_FILE  = './roll_data.json';
const BEER_FILE  = './beer_data.json';
const JOINT_FILE = './joint_data.json';

// ─── Roll data helpers ────────────────────────────────────────────────────────
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return {};
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Beer data helpers ────────────────────────────────────────────────────────
function loadBeerData() {
  if (fs.existsSync(BEER_FILE)) {
    return JSON.parse(fs.readFileSync(BEER_FILE, 'utf8'));
  }
  return {};
}

function saveBeerData(data) {
  fs.writeFileSync(BEER_FILE, JSON.stringify(data, null, 2));
}

// ─── Joint data helpers ───────────────────────────────────────────────────────
function loadJointData() {
  if (fs.existsSync(JOINT_FILE)) {
    return JSON.parse(fs.readFileSync(JOINT_FILE, 'utf8'));
  }
  // holder: userId currently holding the joint (null = no joint lit)
  // log: array of { userId, username, timestamp } pass history
  return { holder: null, holderName: null, log: [] };
}

function saveJointData(data) {
  fs.writeFileSync(JOINT_FILE, JSON.stringify(data, null, 2));
}

function initBeerUser(data, userId, username) {
  if (!data[userId]) {
    data[userId] = { username, beersSent: 0, beersReceived: 0, lastSent: null };
  }
  data[userId].username = username;
  if (data[userId].lastSent === undefined) data[userId].lastSent = null;
}

const BEER_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

function getCooldownRemaining(lastSent) {
  if (!lastSent) return 0;
  const elapsed = Date.now() - new Date(lastSent).getTime();
  return Math.max(0, BEER_COOLDOWN_MS - elapsed);
}

function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ');
}

// ─── Dice ─────────────────────────────────────────────────────────────────────
function rollDice() {
  return Math.floor(Math.random() * 500) + 1;
}

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ─── Message handler ──────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  // ─── ;turnleft ──────────────────────────────────────────────────────────────
  if (content === ';turnleft') {
    await message.reply('https://c.tenor.com/kti1JNwLkBgAAAAC/tenor.gif');
    return;
  }

  // ─── ;deeds ─────────────────────────────────────────────────────────────────
  if (content === ';deeds') {
    await message.reply('lol gay');
    return;
  }

  // ─── ;elton ─────────────────────────────────────────────────────────────────
  if (content === ';elton') {
    await message.reply('lol not gay');
    return;
  }

  // ─── ;roll69 ────────────────────────────────────────────────────────────────
  if (content === ';roll69') {
    const result = rollDice();
    const userId = message.author.id;
    const username = message.author.username;

    const data = loadData();

    if (!data[userId]) {
      data[userId] = { username, hits69: 0, hits420: 0, totalRolls: 0 };
    }

    data[userId].username = username;
    data[userId].totalRolls += 1;

    const isSpecial69 = result === 69;
    const isSpecial420 = result === 420;

    if (isSpecial69) data[userId].hits69 += 1;
    if (isSpecial420) data[userId].hits420 += 1;

    saveData(data);

    const embed = new EmbedBuilder()
      .setColor(isSpecial69 || isSpecial420 ? '#FFD700' : '#5865F2')
      .setTitle(isSpecial69 ? '🎉 NICE — 69!' : isSpecial420 ? '🌿 BLAZE IT — 420!' : '🎲 Roll Result')
      .setDescription(`**${message.author.username}** rolled a **${result}**!`)
      .addFields(
        { name: '69 Hits',     value: `${data[userId].hits69}`,     inline: true },
        { name: '420 Hits',    value: `${data[userId].hits420}`,    inline: true },
        { name: 'Total Rolls', value: `${data[userId].totalRolls}`, inline: true }
      )
      .setFooter({ text: 'Range: 1–500 • Use ;roll69ldr for the leaderboard' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── ;roll69ldr ─────────────────────────────────────────────────────────────
  if (content === ';roll69ldr') {
    const data = loadData();
    const users = Object.values(data);

    if (users.length === 0) {
      await message.reply('No rolls have been recorded yet! Use `;roll69` to start.');
      return;
    }

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

  // ─── ;coldone @user ─────────────────────────────────────────────────────────
  if (content.startsWith(';coldone') && !content.startsWith(';coldones')) {
    const target = message.mentions.users.first();

    if (!target) {
      await message.reply('🍺 You gotta mention someone to send a cold one to! Usage: `;coldone @user`');
      return;
    }
    if (target.id === message.author.id) {
      await message.reply("🍺 You can't send a cold one to yourself… that's just drinking alone.");
      return;
    }
    if (target.bot) {
      await message.reply("🍺 Bots don't drink. Yet.");
      return;
    }

    const beerData = loadBeerData();
    initBeerUser(beerData, message.author.id, message.author.username);
    initBeerUser(beerData, target.id, target.username);

    // ── Cooldown check ──────────────────────────────────────────────────────
    const remaining = getCooldownRemaining(beerData[message.author.id].lastSent);
    if (remaining > 0) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🍺 Easy There, Big Spender!')
        .setDescription(`You already sent a cold one recently. You can send another in **${formatCooldown(remaining)}**.`)
        .setFooter({ text: 'One round every 12 hours!' })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    beerData[message.author.id].beersSent += 1;
    beerData[message.author.id].lastSent = new Date().toISOString();
    beerData[target.id].beersReceived += 1;

    saveBeerData(beerData);

    const sender   = beerData[message.author.id];
    const receiver = beerData[target.id];

    const embed = new EmbedBuilder()
      .setColor('#F4A020')
      .setTitle('🍺 Cold One Incoming!')
      .setDescription(`**${message.author.username}** slid a cold one over to **${target.username}**! Cheers! 🍻`)
      .addFields(
        {
          name: `${message.author.username}'s Stats`,
          value: `📤 Sent: **${sender.beersSent}** • 📥 Received: **${sender.beersReceived}**`,
          inline: false,
        },
        {
          name: `${target.username}'s Stats`,
          value: `📤 Sent: **${receiver.beersSent}** • 📥 Received: **${receiver.beersReceived}**`,
          inline: false,
        }
      )
      .setFooter({ text: 'Use ;coldones to see the full beer board' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── ;coldones (beer leaderboard) ───────────────────────────────────────────
  if (content === ';coldones') {
    const beerData = loadBeerData();
    const users = Object.values(beerData);

    if (users.length === 0) {
      await message.reply('No beers have been sent yet! Use `;coldone @user` to get the round started. 🍺');
      return;
    }

    users.sort((a, b) => {
      const totalA = a.beersSent + a.beersReceived;
      const totalB = b.beersSent + b.beersReceived;
      if (totalB !== totalA) return totalB - totalA;
      return b.beersReceived - a.beersReceived;
    });

    const medals = ['🥇', '🥈', '🥉'];

    const lines = users.map((u, i) => {
      const medal = medals[i] ?? `**#${i + 1}**`;
      const total = u.beersSent + u.beersReceived;
      return (
        `${medal} **${u.username}**\n` +
        `　📤 Sent: **${u.beersSent}** • 📥 Received: **${u.beersReceived}** • 🍺 Total: **${total}**`
      );
    });

    const embed = new EmbedBuilder()
      .setColor('#F4A020')
      .setTitle('🍺 Cold One Leaderboard')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: 'Sorted by total beers • Use ;coldone @user to send a round!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── ;420 @user — light up / pass the joint ──────────────────────────────────
  if (content.startsWith(';420')) {
    const jointData = loadJointData();
    const senderId  = message.author.id;
    const senderName = message.author.username;
    const target    = message.mentions.users.first();

    // ── Sub-command: ;420status ────────────────────────────────────────────────
    if (content === ';420status') {
      if (!jointData.holder) {
        await message.reply('🌿 No joint is currently lit. Use `;420 @user` to spark one up and pass it!');
      } else {
        const lastPass = jointData.log.length > 0 ? jointData.log[jointData.log.length - 1] : null;
        const embed = new EmbedBuilder()
          .setColor('#228B22')
          .setTitle('🚬 Joint Status')
          .setDescription(`**${jointData.holderName}** is currently holding the joint. 🌿`)
          .addFields(
            { name: 'Total Passes', value: `${jointData.log.length}`, inline: true },
            lastPass ? { name: 'Last Passed By', value: `${lastPass.username}`, inline: true } : { name: '\u200b', value: '\u200b', inline: true }
          )
          .setFooter({ text: `Only ${jointData.holderName} can pass it • Use ;420 @user to pass` })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
      }
      return;
    }

    // ── No mention provided ────────────────────────────────────────────────────
    if (!target) {
      await message.reply('🌿 You need to mention someone to pass to! Usage: `;420 @user`\nCheck who has it with `;420status`.');
      return;
    }

    if (target.bot) {
      await message.reply("🌿 Bots don't smoke. It's a whole lung thing.");
      return;
    }

    if (target.id === senderId) {
      await message.reply("🌿 You can't pass it to yourself — just take a hit and hold onto it!");
      return;
    }

    // ── First pass: no joint lit yet — anyone can spark it up ─────────────────
    if (!jointData.holder) {
      jointData.holder     = target.id;
      jointData.holderName = target.username;
      jointData.log.push({ userId: senderId, username: senderName, passedTo: target.username, timestamp: new Date().toISOString() });
      saveJointData(jointData);

      const embed = new EmbedBuilder()
        .setColor('#228B22')
        .setTitle('🔥 Joint Just Got Lit!')
        .setDescription(`**${senderName}** sparked up a fresh joint and passed it straight to **${target.username}**! 🌿💨`)
        .addFields({ name: 'Currently Holding', value: `**${target.username}**`, inline: true })
        .setFooter({ text: `${target.username} must pass it next • Use ;420 @user` })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    // ── Joint is lit — only the current holder can pass ───────────────────────
    if (jointData.holder !== senderId) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚫 Not Your Turn!')
        .setDescription(`Only **${jointData.holderName}** can pass the joint right now. Wait your turn! 🌿`)
        .setFooter({ text: 'Use ;420status to see who\'s holding' })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    // ── Valid pass ─────────────────────────────────────────────────────────────
    jointData.log.push({ userId: senderId, username: senderName, passedTo: target.username, timestamp: new Date().toISOString() });
    jointData.holder     = target.id;
    jointData.holderName = target.username;
    saveJointData(jointData);

    const totalPasses = jointData.log.length;

    const embed = new EmbedBuilder()
      .setColor('#228B22')
      .setTitle('🌿 Pass!')
      .setDescription(`**${senderName}** takes a hit and passes the joint to **${target.username}**! 💨`)
      .addFields(
        { name: 'Now Holding',  value: `**${target.username}**`, inline: true },
        { name: 'Total Passes', value: `**${totalPasses}**`,     inline: true }
      )
      .setFooter({ text: `${target.username} is up • Use ;420 @user to pass | ;420status to check` })
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
