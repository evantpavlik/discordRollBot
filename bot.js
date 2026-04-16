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

function initBeerUser(data, userId, username) {
  if (!data[userId]) {
    data[userId] = { username, beersSent: 0, beersReceived: 0, lastSent: null };
  }
  data[userId].username = username;
  if (data[userId].lastSent === undefined) data[userId].lastSent = null;
}

const BEER_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

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

// ─── Joint data helpers ───────────────────────────────────────────────────────
function loadJointData() {
  if (fs.existsSync(JOINT_FILE)) {
    return JSON.parse(fs.readFileSync(JOINT_FILE, 'utf8'));
  }
  return { holder: null, holderName: null, holdingSince: null, log: [] };
}

function saveJointData(data) {
  fs.writeFileSync(JOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Tic Tac Toe state (in-memory) ───────────────────────────────────────────
const tttGames   = new Map();
const tttInvites = new Map();

function renderBoard(board) {
  const sym = (c) => c === 'X' ? '❌' : c === 'O' ? '⭕' : '⬜';
  return (
    `${sym(board[0])}${sym(board[1])}${sym(board[2])}\n` +
    `${sym(board[3])}${sym(board[4])}${sym(board[5])}\n` +
    `${sym(board[6])}${sym(board[7])}${sym(board[8])}`
  );
}

function boardKey() {
  return '1️⃣2️⃣3️⃣\n4️⃣5️⃣6️⃣\n7️⃣8️⃣9️⃣  ← cell numbers';
}

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
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

  // ─── !DFO — command list ─────────────────────────────────────────────────────
  if (content === '!dfo') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 Available Commands')
      .addFields(
        {
          name: '🎲 Rolling',
          value: [
            '`;roll69` — Roll a number between 1–500. Tracks 69 and 420 hits.',
            '`;roll69ldr` — Show the 69/420 hit leaderboard.',
          ].join('\n'),
        },
        {
          name: '🍺 Cold Ones',
          value: [
            '`;coldone @user` — Send a beer to someone (30 min cooldown).',
            '`;coldones` — Show the beer leaderboard.',
          ].join('\n'),
        },
        {
          name: '🌿 Joint',
          value: [
            '`;420 @user` — Light up / pass the joint to someone.',
            '`;420status` — Check who is holding the joint and for how long.',
            '`;420steal` — Steal the joint if held for 2+ hours.',
          ].join('\n'),
        },
        {
          name: '⭕ Tic Tac Toe',
          value: [
            '`;ttt @user` — Challenge someone to Tic Tac Toe.',
            '`;tttaccept` — Accept a pending challenge.',
            '`;tttdecline` — Decline a pending challenge.',
            '`;ttt1`–`;ttt9` — Place your mark on that cell.',
          ].join('\n'),
        },
        {
          name: '🏇 Horse Race',
          value: [
            '`;race` — Open a race lobby (up to 10 riders, 10 min window).',
            '`;racejoin` — Jump into the open race lobby.',
            '`;racestart` — Host force-starts the race early (min 2 riders).',
          ].join('\n'),
        },
        {
          name: '🔴 Connect 4',
          value: [
            '`;c4 @user` — Challenge someone to Connect 4.',
            '`;c4accept` — Accept a pending challenge.',
            '`;c4decline` — Decline a pending challenge.',
            '`;c41`–`;c47` — Drop your piece into that column.',
          ].join('\n'),
        },
        {
          name: '🎉 Fun',
          value: [
            '`;turnleft` — You know what this does.',
            '`;deeds` — lol.',
            '`;elton` — lol.',
          ].join('\n'),
        }
      )
      .setFooter({ text: 'Use !DFO to show this list any time' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── ;turnleft ──────────────────────────────────────────────────────────────
  if (content === ';turnleft') {
    await message.reply('https://c.tenor.com/kti1JNwLkBgAAAAC/tenor.gif');
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

    const isSpecial69  = result === 69;
    const isSpecial420 = result === 420;

    if (isSpecial69)  data[userId].hits69  += 1;
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
    const data  = loadData();
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
      const medal       = medals[i] ?? `**#${i + 1}**`;
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

    const remaining = getCooldownRemaining(beerData[message.author.id].lastSent);
    if (remaining > 0) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🍺 Easy There, Big Spender!')
        .setDescription(`You already sent a cold one recently. You can send another in **${formatCooldown(remaining)}**.`)
        .setFooter({ text: 'One round every 30 minutes!' })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    beerData[message.author.id].beersSent  += 1;
    beerData[message.author.id].lastSent    = new Date().toISOString();
    beerData[target.id].beersReceived      += 1;

    saveBeerData(beerData);

    const sender   = beerData[message.author.id];
    const receiver = beerData[target.id];

    const embed = new EmbedBuilder()
      .setColor('#F4A020')
      .setTitle('🍺 Cold One Incoming!')
      .setDescription(`**${message.author.username}** slid a cold one over to **${target.username}**! Cheers! 🍻`)
      .addFields(
        { name: `${message.author.username}'s Stats`, value: `📤 Sent: **${sender.beersSent}** • 📥 Received: **${sender.beersReceived}**`, inline: false },
        { name: `${target.username}'s Stats`,         value: `📤 Sent: **${receiver.beersSent}** • 📥 Received: **${receiver.beersReceived}**`, inline: false }
      )
      .setFooter({ text: 'Use ;coldones to see the full beer board' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // // ─── ;coldones leaderboard ───────────────────────────────────────────────────
  // if (content === ';coldones') {
  //   const beerData = loadBeerData();
  //   const users    = Object.values(beerData);

  //   if (users.length === 0) {
  //     await message.reply('No beers have been sent yet! Use `;coldone @user` to get the round started. 🍺');
  //     return;
  //   }

  //   users.sort((a, b) => {
  //     const totalA = a.beersSent + a.beersReceived;
  //     const totalB = b.beersSent + b.beersReceived;
  //     if (totalB !== totalA) return totalB - totalA;
  //     return b.beersReceived - a.beersReceived;
  //   });

  //   const medals = ['🥇', '🥈', '🥉'];

  //   const lines = users.map((u, i) => {
  //     const medal = medals[i] ?? `**#${i + 1}**`;
  //     const total = u.beersSent + u.beersReceived;
  //     return (
  //       `${medal} **${u.username}**\n` +
  //       `　📤 Sent: **${u.beersSent}** • 📥 Received: **${u.beersReceived}** • 🍺 Total: **${total}**`
  //     );
  //   });

  //   const embed = new EmbedBuilder()
  //     .setColor('#F4A020')
  //     .setTitle('🍺 Cold One Leaderboard')
  //     .setDescription(lines.join('\n\n'))
  //     .setFooter({ text: 'Sorted by total beers • Use ;coldone @user to send a round!' })
  //     .setTimestamp();

  //   await message.reply({ embeds: [embed] });
  //   return;
  // }

  // ─── ;420 joint system ───────────────────────────────────────────────────────
  if (content.startsWith(';420')) {
    const jointData  = loadJointData();
    const senderId   = message.author.id;
    const senderName = message.author.username;
    const target     = message.mentions.users.first();

    const STEAL_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

    function holdingDuration() {
      if (!jointData.holdingSince) return 0;
      return Date.now() - new Date(jointData.holdingSince).getTime();
    }

    function formatHoldTime(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      const parts = [];
      if (h) parts.push(`${h}h`);
      if (m) parts.push(`${m}m`);
      parts.push(`${s}s`);
      return parts.join(' ');
    }

    function stealable() {
      return jointData.holder && holdingDuration() >= STEAL_THRESHOLD_MS;
    }

    function statusLine() {
      if (!jointData.holder) return null;
      const held     = holdingDuration();
      const timeStr  = formatHoldTime(held);
      const canSteal = held >= STEAL_THRESHOLD_MS;
      return canSteal
        ? `⚠️ **${jointData.holderName}** has been holding for **${timeStr}** — anyone can \`;420steal\`!`
        : `⏱️ **${jointData.holderName}** has been holding for **${timeStr}** (stealable after 2h)`;
    }

    // ;420status
    if (content === ';420status') {
      if (!jointData.holder) {
        await message.reply('🌿 No joint is currently lit. Use `;420 @user` to spark one up and pass it!');
      } else {
        const lastPass = jointData.log.length > 0 ? jointData.log[jointData.log.length - 1] : null;
        const held     = holdingDuration();
        const canSteal = held >= STEAL_THRESHOLD_MS;
        const embed = new EmbedBuilder()
          .setColor(canSteal ? '#E74C3C' : '#228B22')
          .setTitle(canSteal ? '🚨 Joint Status — STEALABLE!' : '🚬 Joint Status')
          .setDescription(statusLine())
          .addFields(
            { name: 'Total Passes', value: `${jointData.log.length}`, inline: true },
            { name: 'Held For',     value: formatHoldTime(held),       inline: true },
            lastPass
              ? { name: 'Last Passed By', value: lastPass.username, inline: true }
              : { name: '\u200b', value: '\u200b', inline: true }
          )
          .setFooter({ text: canSteal ? 'Use ;420steal to snatch it!' : `Only ${jointData.holderName} can pass it • ;420 @user` })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
      }
      return;
    }

    // ;420steal
    if (content === ';420steal') {
      if (!jointData.holder) {
        await message.reply("🌿 There's no joint to steal — nobody has it right now!");
        return;
      }
      if (jointData.holder === senderId) {
        await message.reply("🌿 You can't steal your own joint. Just... pass it.");
        return;
      }
      if (!stealable()) {
        const remaining = STEAL_THRESHOLD_MS - holdingDuration();
        await message.reply(`⏱️ Not yet! **${jointData.holderName}** has only held it for **${formatHoldTime(holdingDuration())}**. You can steal it in **${formatHoldTime(remaining)}**.`);
        return;
      }

      const prevHolder = jointData.holderName;
      jointData.log.push({ userId: senderId, username: senderName, passedTo: senderName, action: 'steal', timestamp: new Date().toISOString() });
      jointData.holder       = senderId;
      jointData.holderName   = senderName;
      jointData.holdingSince = new Date().toISOString();
      saveJointData(jointData);

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('😤 Joint Stolen!')
        .setDescription(`**${senderName}** snatched the joint from **${prevHolder}** after they bogarted it! 🌿💨`)
        .addFields(
          { name: 'Now Holding',  value: `**${senderName}**`,       inline: true },
          { name: 'Total Passes', value: `${jointData.log.length}`, inline: true }
        )
        .setFooter({ text: 'Pass it along with ;420 @user before someone steals it from you!' })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    // No mention
    if (!target) {
      await message.reply('🌿 You need to mention someone to pass to! Usage: `;420 @user`\nCheck status with `;420status` • Steal with `;420steal`.');
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

    // First light
    if (!jointData.holder) {
      jointData.holder       = target.id;
      jointData.holderName   = target.username;
      jointData.holdingSince = new Date().toISOString();
      jointData.log.push({ userId: senderId, username: senderName, passedTo: target.username, timestamp: new Date().toISOString() });
      saveJointData(jointData);

      const embed = new EmbedBuilder()
        .setColor('#228B22')
        .setTitle('🔥 Joint Just Got Lit!')
        .setDescription(`**${senderName}** sparked up a fresh joint and passed it to **${target.username}**! 🌿💨`)
        .addFields(
          { name: 'Currently Holding', value: `**${target.username}**`, inline: true },
          { name: 'Held For',          value: '0s',                      inline: true }
        )
        .setFooter({ text: `${target.username} must pass it • ;420 @user | Can be stolen after 2h` })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    // Not your turn
    if (jointData.holder !== senderId) {
      const held     = holdingDuration();
      const canSteal = held >= STEAL_THRESHOLD_MS;
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚫 Not Your Turn!')
        .setDescription(
          canSteal
            ? `**${jointData.holderName}** has been holding for **${formatHoldTime(held)}** — use \`;420steal\` to snatch it!`
            : `Only **${jointData.holderName}** can pass the joint right now. They've held it for **${formatHoldTime(held)}**.`
        )
        .setFooter({ text: canSteal ? 'Use ;420steal!' : `Stealable after 2h • ${formatHoldTime(STEAL_THRESHOLD_MS - held)} remaining` })
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    // Valid pass
    const heldFor = holdingDuration();
    jointData.log.push({ userId: senderId, username: senderName, passedTo: target.username, timestamp: new Date().toISOString() });
    jointData.holder       = target.id;
    jointData.holderName   = target.username;
    jointData.holdingSince = new Date().toISOString();
    saveJointData(jointData);

    const embed = new EmbedBuilder()
      .setColor('#228B22')
      .setTitle('🌿 Pass!')
      .setDescription(`**${senderName}** takes a hit and passes the joint to **${target.username}**! 💨`)
      .addFields(
        { name: 'Now Holding',  value: `**${target.username}**`,  inline: true },
        { name: 'Total Passes', value: `${jointData.log.length}`, inline: true },
        { name: 'Held For',     value: formatHoldTime(heldFor),    inline: true }
      )
      .setFooter({ text: `${target.username} is up • ;420 @user | Can be stolen after 2h` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ─── TIC TAC TOE ─────────────────────────────────────────────────────────────
  if (content.startsWith(';ttt ') || content === ';tttaccept' || content === ';tttdecline' || content.match(/^;ttt\d$/)) {

    const tttMove = content.match(/^;ttt(\d)$/);

    // ;ttt @user — invite
    if (content.startsWith(';ttt ')) {
      const target = message.mentions.users.first();

      if (!target) {
        await message.reply('❌ Mention someone to challenge! Usage: `;ttt @user`');
        return;
      }
      if (target.id === message.author.id) {
        await message.reply("❌ You can't challenge yourself!");
        return;
      }
      if (target.bot) {
        await message.reply("❌ Bots don't play tic tac toe. They always win.");
        return;
      }
      if (tttGames.has(message.channel.id)) {
        await message.reply('❌ A game is already running in this channel! Finish it first.');
        return;
      }

      const inviteKey = `${message.author.id}-${target.id}-${message.channel.id}`;
      tttInvites.set(inviteKey, {
        inviterId:   message.author.id,
        inviterName: message.author.username,
        inviteeId:   target.id,
        inviteeName: target.username,
        channelId:   message.channel.id,
      });

      setTimeout(() => tttInvites.delete(inviteKey), 60000);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭕ Tic Tac Toe Challenge!')
        .setDescription(`**${message.author.username}** challenged **${target.username}** to a game of Tic Tac Toe!`)
        .addFields({ name: 'How to respond', value: `**${target.username}**: type \`;tttaccept\` to play or \`;tttdecline\` to refuse.\nExpires in 60 seconds.` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // ;tttaccept
    if (content === ';tttaccept') {
      let foundKey = null;
      for (const [key, inv] of tttInvites.entries()) {
        if (inv.inviteeId === message.author.id && inv.channelId === message.channel.id) {
          foundKey = key; break;
        }
      }

      if (!foundKey) {
        await message.reply("❌ You don't have a pending Tic Tac Toe invite in this channel.");
        return;
      }

      const inv = tttInvites.get(foundKey);
      tttInvites.delete(foundKey);

      const game = {
        board:   Array(9).fill(null),
        players: { X: inv.inviterId,   O: inv.inviteeId   },
        names:   { X: inv.inviterName, O: inv.inviteeName },
        turn:    'X',
        channelId: message.channel.id,
      };
      tttGames.set(message.channel.id, game);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('⭕ Game On!')
        .setDescription(
          `**${inv.inviterName}** ❌  vs  **${inv.inviteeName}** ⭕\n\n` +
          renderBoard(game.board) +
          `\n\n**${game.names[game.turn]}'s turn** (${game.turn === 'X' ? '❌' : '⭕'})\n` +
          `Use \`;ttt1\`–\`;ttt9\` to place your mark.`
        )
        .setFooter({ text: boardKey() })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // ;tttdecline
    if (content === ';tttdecline') {
      let foundKey = null;
      for (const [key, inv] of tttInvites.entries()) {
        if (inv.inviteeId === message.author.id && inv.channelId === message.channel.id) {
          foundKey = key; break;
        }
      }

      if (!foundKey) {
        await message.reply("❌ You don't have a pending invite to decline.");
        return;
      }

      tttInvites.delete(foundKey);
      await message.reply(`**${message.author.username}** declined the challenge. Maybe next time! 😔`);
      return;
    }

    // ;ttt1–;ttt9
    if (tttMove) {
      const cellIndex = parseInt(tttMove[1]) - 1;
      const game      = tttGames.get(message.channel.id);

      if (!game) {
        await message.reply('❌ No active Tic Tac Toe game in this channel. Use `;ttt @user` to start one!');
        return;
      }

      const currentPlayerId = game.players[game.turn];
      if (message.author.id !== currentPlayerId) {
        await message.reply(`❌ It's **${game.names[game.turn]}'s** turn, not yours!`);
        return;
      }

      if (game.board[cellIndex] !== null) {
        await message.reply('❌ That cell is already taken! Pick another (1–9).');
        return;
      }

      game.board[cellIndex] = game.turn;

      const winner = checkWinner(game.board);
      const isDraw = !winner && game.board.every(c => c !== null);

      if (winner) {
        tttGames.delete(message.channel.id);
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🏆 ${game.names[winner]} wins!`)
          .setDescription(`**${game.names.X}** ❌  vs  **${game.names.O}** ⭕\n\n` + renderBoard(game.board))
          .setFooter({ text: 'Use ;ttt @user to start a new game!' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      if (isDraw) {
        tttGames.delete(message.channel.id);
        const embed = new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle("🤝 It's a Draw!")
          .setDescription(`**${game.names.X}** ❌  vs  **${game.names.O}** ⭕\n\n` + renderBoard(game.board))
          .setFooter({ text: 'Use ;ttt @user to rematch!' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      game.turn = game.turn === 'X' ? 'O' : 'X';
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭕ Tic Tac Toe')
        .setDescription(
          `**${game.names.X}** ❌  vs  **${game.names.O}** ⭕\n\n` +
          renderBoard(game.board) +
          `\n\n**${game.names[game.turn]}'s turn** (${game.turn === 'X' ? '❌' : '⭕'})\n` +
          `Use \`;ttt1\`–\`;ttt9\` to place your mark.`
        )
        .setFooter({ text: boardKey() })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }
  }

  // ─── CONNECT 4 ───────────────────────────────────────────────────────────────
  if (
    content.startsWith(';c4 ') ||
    content === ';c4accept'    ||
    content === ';c4decline'   ||
    content.match(/^;c4[1-7]$/)
  ) {
    const c4Move = content.match(/^;c4([1-7])$/);

    // ;c4 @user — challenge
    if (content.startsWith(';c4 ')) {
      const target = message.mentions.users.first();

      if (!target) {
        await message.reply('🔴 Mention someone to challenge! Usage: `;c4 @user`');
        return;
      }
      if (target.id === message.author.id) {
        await message.reply("🔴 You can't challenge yourself!");
        return;
      }
      if (target.bot) {
        await message.reply("🔴 Bots don't play Connect 4.");
        return;
      }
      if (c4Games.has(message.channel.id)) {
        await message.reply('🔴 A Connect 4 game is already running in this channel!');
        return;
      }

      const inviteKey = `c4-${message.author.id}-${message.channel.id}`;
      c4Invites.set(inviteKey, {
        inviterId:   message.author.id,
        inviterName: message.author.username,
        inviteeId:   target.id,
        inviteeName: target.username,
        channelId:   message.channel.id,
      });
      setTimeout(() => c4Invites.delete(inviteKey), 60000);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔴 Connect 4 Challenge!')
        .setDescription(
          `**${message.author.username}** 🔴  challenges  **${target.username}** 🟡 to Connect 4!\n\n` +
          `**${target.username}**: type \`;c4accept\` to play or \`;c4decline\` to refuse.\n` +
          `*Expires in 60 seconds.*`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // ;c4accept
    if (content === ';c4accept') {
      let foundKey = null;
      for (const [key, inv] of c4Invites.entries()) {
        if (inv.inviteeId === message.author.id && inv.channelId === message.channel.id) {
          foundKey = key; break;
        }
      }
      if (!foundKey) {
        await message.reply("🔴 You don't have a pending Connect 4 invite in this channel.");
        return;
      }

      const inv = c4Invites.get(foundKey);
      c4Invites.delete(foundKey);

      // 6 rows x 7 cols, null = empty, 1 = red, 2 = yellow
      const game = {
        board:   Array.from({ length: 6 }, () => Array(7).fill(null)),
        players: { 1: inv.inviterId,   2: inv.inviteeId   },
        names:   { 1: inv.inviterName, 2: inv.inviteeName },
        turn: 1,
        channelId: message.channel.id,
      };
      c4Games.set(message.channel.id, game);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔴 Connect 4 — Game On!')
        .setDescription(
          `**${inv.inviterName}** 🔴  vs  **${inv.inviteeName}** 🟡\n\n` +
          renderC4Board(game.board) +
          `\n\n**${game.names[game.turn]}'s turn** (${game.turn === 1 ? '🔴' : '🟡'})\n` +
          `Drop a piece with \`;c41\`–\`;c47\``
        )
        .setFooter({ text: c4ColumnKey() })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // ;c4decline
    if (content === ';c4decline') {
      let foundKey = null;
      for (const [key, inv] of c4Invites.entries()) {
        if (inv.inviteeId === message.author.id && inv.channelId === message.channel.id) {
          foundKey = key; break;
        }
      }
      if (!foundKey) {
        await message.reply("🔴 You don't have a pending Connect 4 invite to decline.");
        return;
      }
      c4Invites.delete(foundKey);
      await message.reply(`**${message.author.username}** declined the Connect 4 challenge. 😔`);
      return;
    }

    // ;c41–;c47 — drop piece
    if (c4Move) {
      const col  = parseInt(c4Move[1]) - 1; // 0-based
      const game = c4Games.get(message.channel.id);

      if (!game) {
        await message.reply('🔴 No active Connect 4 game here. Use `;c4 @user` to start one!');
        return;
      }

      const currentPlayerId = game.players[game.turn];
      if (message.author.id !== currentPlayerId) {
        await message.reply(`🔴 It's **${game.names[game.turn]}'s** turn, not yours!`);
        return;
      }

      // Find lowest empty row in this column
      let placedRow = -1;
      for (let row = 5; row >= 0; row--) {
        if (game.board[row][col] === null) {
          placedRow = row;
          break;
        }
      }

      if (placedRow === -1) {
        await message.reply(`🔴 Column ${col + 1} is full! Pick another column.`);
        return;
      }

      game.board[placedRow][col] = game.turn;

      const winner  = checkC4Winner(game.board);
      const isDraw  = !winner && game.board[0].every(c => c !== null);

      if (winner) {
        c4Games.delete(message.channel.id);
        const embed = new EmbedBuilder()
          .setColor(winner === 1 ? '#E74C3C' : '#F1C40F')
          .setTitle(`${winner === 1 ? '🔴' : '🟡'} ${game.names[winner]} wins Connect 4!`)
          .setDescription(
            `**${game.names[1]}** 🔴  vs  **${game.names[2]}** 🟡\n\n` +
            renderC4Board(game.board)
          )
          .setFooter({ text: 'Use ;c4 @user for a rematch!' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      if (isDraw) {
        c4Games.delete(message.channel.id);
        const embed = new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle("🤝 Connect 4 — It's a Draw!")
          .setDescription(
            `**${game.names[1]}** 🔴  vs  **${game.names[2]}** 🟡\n\n` +
            renderC4Board(game.board)
          )
          .setFooter({ text: 'Use ;c4 @user for a rematch!' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      game.turn = game.turn === 1 ? 2 : 1;
      const embed = new EmbedBuilder()
        .setColor(game.turn === 1 ? '#E74C3C' : '#F1C40F')
        .setTitle('Connect 4')
        .setDescription(
          `**${game.names[1]}** 🔴  vs  **${game.names[2]}** 🟡\n\n` +
          renderC4Board(game.board) +
          `\n\n**${game.names[game.turn]}'s turn** (${game.turn === 1 ? '🔴' : '🟡'})\n` +
          `Drop a piece with \`;c41\`–\`;c47\``
        )
        .setFooter({ text: c4ColumnKey() })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }
  }

  // ─── ;race ───────────────────────────────────────────────────────────────────
  if (content === ';race' || content === ';racejoin') {

    // ── ;race — open a lobby ──────────────────────────────────────────────────
    if (content === ';race') {
      if (raceLobbies.has(message.channel.id)) {
        const lobby = raceLobbies.get(message.channel.id);
        if (lobby.started) {
          await message.reply('🏇 A race is already in progress in this channel!');
        } else {
          await message.reply(`🏇 A race lobby is already open! Type \`;racejoin\` to enter. (${lobby.riders.length}/10 joined)`);
        }
        return;
      }

      const lobby = {
        hostId:   message.author.id,
        hostName: message.author.username,
        riders:   [{ id: message.author.id, name: message.author.username }],
        started:  false,
        channelId: message.channel.id,
      };
      raceLobbies.set(message.channel.id, lobby);

      const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle('🏇 Horse Race — Lobby Open!')
        .setDescription(
          `**${message.author.username}** is opening a race!\n\n` +
          `Type \`;racejoin\` to saddle up! 🐴\n\n` +
          `**Riders (1/10):**\n🏇 ${message.author.username}\n\n` +
          `Race starts automatically after **10 minutes** or when the host types \`;racestart\`.`
        )
        .setFooter({ text: 'Minimum 2 riders to start • Max 10' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Auto-start or cancel after 10 minutes
      setTimeout(async () => {
        const l = raceLobbies.get(message.channel.id);
        if (!l || l.started) return;
        if (l.riders.length < 2) {
          raceLobbies.delete(message.channel.id);
          try { await message.channel.send('🏇 Race cancelled — not enough riders joined in time. (Need at least 2)'); } catch {}
          return;
        }
        await runRace(message.channel, l);
      }, 10 * 60 * 1000);

      return;
    }

    // ── ;racejoin ─────────────────────────────────────────────────────────────
    if (content === ';racejoin') {
      if (!raceLobbies.has(message.channel.id)) {
        await message.reply('🏇 No race lobby is open! Use `;race` to start one.');
        return;
      }
      const lobby = raceLobbies.get(message.channel.id);
      if (lobby.started) {
        await message.reply("🏇 The race already started — you're too late!");
        return;
      }
      if (lobby.riders.some(r => r.id === message.author.id)) {
        await message.reply("🏇 You're already in the race!");
        return;
      }
      if (lobby.riders.length >= 10) {
        await message.reply('🏇 The race is full! (10/10)');
        return;
      }

      lobby.riders.push({ id: message.author.id, name: message.author.username });

      const riderList = lobby.riders.map((r, i) => `${HORSE_EMOJIS[i]} ${r.name}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle(`🏇 ${message.author.username} joined the race!`)
        .setDescription(
          `**Riders (${lobby.riders.length}/10):**\n${riderList}\n\n` +
          (lobby.riders.length >= 2
            ? `Host can type \`;racestart\` to begin early!`
            : `Need at least 1 more rider to start.`)
        )
        .setFooter({ text: 'Type ;racejoin to enter!' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }
  }

  // ;racestart — host forces start
  if (content === ';racestart') {
    if (!raceLobbies.has(message.channel.id)) {
      await message.reply('🏇 No race lobby is open! Use `;race` to start one.');
      return;
    }
    const lobby = raceLobbies.get(message.channel.id);
    if (lobby.started) {
      await message.reply('🏇 Race already started!');
      return;
    }
    if (message.author.id !== lobby.hostId) {
      await message.reply(`🏇 Only **${lobby.hostName}** (the host) can force-start the race!`);
      return;
    }
    if (lobby.riders.length < 2) {
      await message.reply('🏇 Need at least 2 riders to start!');
      return;
    }
    await runRace(message.channel, lobby);
    return;
  }
});

// ─── Connect 4 state & helpers ────────────────────────────────────────────────
const c4Games   = new Map();
const c4Invites = new Map();

function renderC4Board(board) {
  const cell = (v) => v === 1 ? '🔴' : v === 2 ? '🟡' : '⚫';
  const rows = board.map(row => row.map(cell).join('')).join('\n');
  return rows;
}

function c4ColumnKey() {
  return '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
}

function checkC4Winner(board) {
  const ROWS = 6, COLS = 7;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (!v) continue;

      // Horizontal
      if (c + 3 < COLS &&
          board[r][c+1] === v && board[r][c+2] === v && board[r][c+3] === v) return v;
      // Vertical
      if (r + 3 < ROWS &&
          board[r+1][c] === v && board[r+2][c] === v && board[r+3][c] === v) return v;
      // Diagonal down-right
      if (r + 3 < ROWS && c + 3 < COLS &&
          board[r+1][c+1] === v && board[r+2][c+2] === v && board[r+3][c+3] === v) return v;
      // Diagonal down-left
      if (r + 3 < ROWS && c - 3 >= 0 &&
          board[r+1][c-1] === v && board[r+2][c-2] === v && board[r+3][c-3] === v) return v;
    }
  }
  return null;
}

// ─── Race state & helpers ─────────────────────────────────────────────────────
const raceLobbies = new Map();

const HORSE_EMOJIS  = ['🐴','🦄','🐎','🏇','🐻','🐯','🦊','🐺','🦁','🐸'];
const TRACK_LENGTH  = 20; // steps to finish line
const RACE_DURATION = 20; // seconds total
const TICK_INTERVAL = 2000; // ms between updates (10 ticks over 20s)
const TICKS         = RACE_DURATION * 1000 / TICK_INTERVAL;

function buildTrack(position, emoji) {
  const filled = Math.min(Math.floor(position), TRACK_LENGTH);
  const track  = '▪️'.repeat(filled) + emoji + '▫️'.repeat(Math.max(0, TRACK_LENGTH - filled));
  return track + '🏁';
}

function buildRaceBoard(riders, positions, finished) {
  return riders.map((r, i) => {
    const pos   = positions[i];
    const medal = finished[i] === 1 ? ' 🥇' : finished[i] === 2 ? ' 🥈' : finished[i] === 3 ? ' 🥉' : '';
    return `\`${r.name.padEnd(12).slice(0, 12)}\` ${buildTrack(pos, HORSE_EMOJIS[i])}${medal}`;
  }).join('\n');
}

async function runRace(channel, lobby) {
  lobby.started = true;

  const riders    = lobby.riders;
  const positions = riders.map(() => 0);
  const finished  = riders.map(() => null);
  let   place     = 1;

  // Countdown
  const countdownEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🏇 Race Starting!')
    .setDescription(
      `**Riders:**\n` +
      riders.map((r, i) => `${HORSE_EMOJIS[i]} **${r.name}**`).join('\n') +
      `\n\n🚦 Get ready... **3... 2... 1... GO!** 🚦`
    )
    .setTimestamp();

  let raceMsg;
  try {
    raceMsg = await channel.send({ embeds: [countdownEmbed] });
  } catch { raceLobbies.delete(channel.id); return; }

  await new Promise(r => setTimeout(r, 1500));

  // Race loop
  for (let tick = 0; tick < TICKS; tick++) {
    for (let i = 0; i < riders.length; i++) {
      if (finished[i] !== null) continue;

      // Completely fresh random roll every tick for every horse
      // Base: 1.0–2.5 steps, with independent burst/stumble per horse per tick
      const base    = 1.0 + Math.random() * 1.5;
      const burst   = Math.random() < 0.25 ? 1.5 + Math.random() * 1.0 : 1.0;
      const stumble = Math.random() < 0.15 ? 0.1 + Math.random() * 0.3 : 1.0;
      const step    = base * burst * stumble;

      positions[i] = Math.min(TRACK_LENGTH, positions[i] + step);

      if (positions[i] >= TRACK_LENGTH && finished[i] === null) {
        finished[i] = place++;
      }
    }

    const allDone  = finished.every(f => f !== null);
    const progress = Math.round(((tick + 1) / TICKS) * 100);

    const board = buildRaceBoard(riders, positions, finished);
    const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

    const embed = new EmbedBuilder()
      .setColor('#27AE60')
      .setTitle(`🏇 Race in Progress!  [${progressBar}] ${progress}%`)
      .setDescription(board)
      .setFooter({ text: `Tick ${tick + 1}/${TICKS} • ${Math.round(RACE_DURATION - (tick + 1) * (RACE_DURATION / TICKS))}s remaining` })
      .setTimestamp();

    try { await raceMsg.edit({ embeds: [embed] }); } catch {}

    if (allDone) break;
    await new Promise(r => setTimeout(r, TICK_INTERVAL));
  }

  // Mark any still running horses as DNF position
  for (let i = 0; i < riders.length; i++) {
    if (finished[i] === null) finished[i] = place++;
  }

  const results = riders
    .map((r, i) => ({ name: r.name, emoji: HORSE_EMOJIS[i], place: finished[i] }))
    .sort((a, b) => a.place - b.place);

  const placeEmoji = ['🥇', '🥈', '🥉'];
  const podium = results.map((r, i) =>
    `${placeEmoji[i] ?? `**#${i + 1}**`} ${r.emoji} **${r.name}**`
  ).join('\n');

  const finalBoard = buildRaceBoard(riders, positions.map(() => TRACK_LENGTH), finished);

  const finalEmbed = new EmbedBuilder()
    .setColor('#F1C40F')
    .setTitle('🏆 Race Finished!')
    .setDescription(finalBoard + `\n\n**🏆 Final Results:**\n${podium}`)
    .setFooter({ text: 'Use ;race to run another!' })
    .setTimestamp();

  try { await raceMsg.edit({ embeds: [finalEmbed] }); } catch {}
  raceLobbies.delete(channel.id);
}

// ─── Start the bot ────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

client.login(TOKEN);
