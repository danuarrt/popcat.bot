import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import { DisTube } from 'distube';
import { SoundCloudPlugin } from '@distube/soundcloud';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PREFIX = '!';

// ==== DISTUBE SETUP (SoundCloud Only) ====
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  leaveOnFinish: false,
  searchSongs: 0,
  plugins: [new SoundCloudPlugin()],
  youtubeDL: false,
  ytdlOptions: {
    highWaterMark: 1 << 25
  }
});

// ==== READY ====
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==== MUSIC COMMANDS ====
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  const vc = msg.member.voice?.channel;
  const queue = distube.getQueue(msg);

  if (['play', 'p'].includes(cmd)) {
    if (!vc) return msg.reply('❌ Join a voice channel first.');
    distube.play(vc, args.join(' '), { textChannel: msg.channel, member: msg.member });
  } else if (cmd === 'skip') {
    if (!queue) return msg.reply('🚫 No song to skip.');
    queue.skip();
    msg.channel.send('⏭️ Skipped!');
  } else if (cmd === 'stop') {
    if (!queue) return msg.reply('🚫 No song playing.');
    queue.stop();
    msg.channel.send('🛑 Stopped!');
  } else if (cmd === 'queue') {
    if (!queue) return msg.reply('📭 Queue is empty.');
    msg.channel.send(`🎶 **Queue:**\n${queue.songs.map((s, i) => `${i + 1}. ${s.name}`).join('\n')}`);
  } else if (cmd === 'np') {
    if (!queue) return msg.reply('🚫 Nothing is playing.');
    msg.channel.send(`🎵 Now playing: **${queue.songs[0].name}**`);
  } else if (cmd === 'volume') {
    const vol = parseInt(args[0]);
    if (isNaN(vol)) return msg.reply('🔊 Volume must be a number.');
    distube.setVolume(msg, vol);
    msg.channel.send(`🔊 Volume set to **${vol}%**`);
  }
});

// ==== FULL LOGGING ====

client.on('messageCreate', message => {
  if (!message.guild || message.author.bot) return;

  const content = message.content?.trim() || '*[No text content]*';
  const attachments = [...message.attachments.values()].map(a => a.url).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setAuthor({ name: `${message.author.tag} (${message.author.id})`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`💬 Message sent in <#${message.channel.id}> [Jump to message](${message.url})`)
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'User ID', value: `${message.author.id}`, inline: true },
      { name: 'Content', value: `\`\`\`${content}\`\`\`` }
    )
    .setTimestamp();

  if (attachments) {
    embed.addFields({ name: '📎 Attachments', value: attachments });
    embed.setImage(attachments.split('\n')[0]);
  }

  sendEmbedLog(embed, message.guild);
});

client.on('messageUpdate', (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.partial || newMsg.partial) return;
  if (oldMsg.content === newMsg.content) return;

  const embed = new EmbedBuilder()
    .setColor('#facc15')
    .setAuthor({ name: `${oldMsg.author.tag} (${oldMsg.author.id})`, iconURL: oldMsg.author.displayAvatarURL() })
    .setDescription(`✏️ Message edited in <#${oldMsg.channel.id}> [Jump to message](${newMsg.url})`)
    .addFields(
      { name: 'User', value: `<@${oldMsg.author.id}>`, inline: true },
      { name: 'User ID', value: `${oldMsg.author.id}`, inline: true },
      { name: 'Before', value: `\`\`\`${oldMsg.content || '[No content]'}\`\`\`` },
      { name: 'After', value: `\`\`\`${newMsg.content || '[No content]'}\`\`\`` }
    )
    .setTimestamp();

  sendEmbedLog(embed, oldMsg.guild);
});

client.on('messageDelete', message => {
  if (!message.guild || message.partial) return;
  const content = message.content?.trim() || '*[No text content]*';
  const attachments = [...message.attachments.values()].map(a => a.url).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#ff5555')
    .setAuthor({ name: `${message.author?.tag ?? 'Unknown'} (${message.author?.id ?? 'N/A'})`, iconURL: message.author?.displayAvatarURL() ?? null })
    .setDescription(`🗑️ Message deleted in <#${message.channel.id}>`)
    .addFields(
      { name: 'User', value: `<@${message.author?.id}>`, inline: true },
      { name: 'User ID', value: `${message.author?.id}`, inline: true },
      { name: 'Content', value: `\`\`\`${content}\`\`\`` }
    )
    .setTimestamp();

  if (attachments) {
    embed.addFields({ name: '📎 Attachments', value: attachments });
    embed.setImage(attachments.split('\n')[0]);
  }

  sendEmbedLog(embed, message.guild);
});

// MEMBER EVENTS
client.on('guildMemberAdd', member => {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setDescription(`🟢 <@${member.id}> joined the server.\n**User ID:** ${member.id}`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

client.on('guildMemberRemove', member => {
  const embed = new EmbedBuilder()
    .setColor('Red')
    .setDescription(`🔴 <@${member.id}> left the server.\n**User ID:** ${member.id}`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

client.on('guildMemberUpdate', (oldM, newM) => {
  const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
  const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));

  for (const role of added.values()) {
    const embed = new EmbedBuilder()
      .setColor('Green')
      .setDescription(`➕ Role **${role.name}** added to <@${newM.id}>.\n**User ID:** ${newM.id}`)
      .setTimestamp();
    sendEmbedLog(embed, newM.guild);
  }

  for (const role of removed.values()) {
    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setDescription(`➖ Role **${role.name}** removed from <@${newM.id}>.\n**User ID:** ${newM.id}`)
      .setTimestamp();
    sendEmbedLog(embed, newM.guild);
  }
});

client.on('guildBanAdd', ban => {
  const embed = new EmbedBuilder()
    .setColor('#e11d48')
    .setDescription(`🔨 <@${ban.user.id}> was banned.\n**User ID:** ${ban.user.id}`)
    .setTimestamp();
  sendEmbedLog(embed, ban.guild);
});

client.on('guildBanRemove', ban => {
  const embed = new EmbedBuilder()
    .setColor('#4ade80')
    .setDescription(`⚖️ <@${ban.user.id}> was unbanned.\n**User ID:** ${ban.user.id}`)
    .setTimestamp();
  sendEmbedLog(embed, ban.guild);
});

client.on('channelUpdate', (oldCh, newCh) => {
  if (oldCh.name !== newCh.name) {
    const embed = new EmbedBuilder()
      .setColor('#00bcd4')
      .setDescription(`🔁 Channel renamed from **${oldCh.name}** to **${newCh.name}**`)
      .setTimestamp();
    sendEmbedLog(embed, newCh.guild);
  }
});

// === SEND LOGS ===
async function sendEmbedLog(embed, guild) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  try {
    await logChannel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Log error:', e);
  }
}

client.login(process.env.TOKEN);
