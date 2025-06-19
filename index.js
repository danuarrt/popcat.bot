import { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } from 'discord.js';
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
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

function sendEmbedLog(embed, guild) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  ch.send({ embeds: [embed] }).catch(console.error);
}

// 1. Pesan Masuk / Edit / Dihapus
client.on('messageCreate', message => {
  if (!message.guild || message.author.bot) return;
  const embed = new EmbedBuilder()
    .setColor('#4ade80')
    .setAuthor({ name: `${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`📩 Message sent in <#${message.channel.id}>
\`\`\`${message.content || '[No content]'}\`\`\``)
    .setTimestamp();
  sendEmbedLog(embed, message.guild);
});

client.on('messageUpdate', (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.partial || newMsg.partial || oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setColor('#facc15')
    .setAuthor({ name: `${newMsg.author.tag}`, iconURL: newMsg.author.displayAvatarURL() })
    .setDescription(`✏️ Message edited in <#${newMsg.channel.id}>`)
    .addFields(
      { name: 'Before', value: `\`\`\`${oldMsg.content || '[No content]'}\`\`\`` },
      { name: 'After', value: `\`\`\`${newMsg.content || '[No content]'}\`\`\`` }
    )
    .setTimestamp();
  sendEmbedLog(embed, newMsg.guild);
});

client.on('messageDelete', message => {
  if (!message.guild || message.partial) return;
  const embed = new EmbedBuilder()
    .setColor('#ef4444')
    .setAuthor({ name: `${message.author?.tag || 'Unknown'}` })
    .setDescription(`🗑️ Message deleted in <#${message.channel.id}>
\`\`\`${message.content || '[No content]'}\`\`\``)
    .setTimestamp();
  sendEmbedLog(embed, message.guild);
});

// 2. Join / Leave / Kick / Ban
client.on('guildMemberAdd', member => {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setDescription(`🟢 <@${member.id}> joined the server.`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

client.on('guildMemberRemove', async member => {
  const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
  const kick = logs?.entries.first();
  const kickedBy = kick?.target.id === member.id ? ` by <@${kick.executor.id}>` : '';
  const embed = new EmbedBuilder()
    .setColor('Red')
    .setDescription(`🔴 <@${member.id}> left the server${kickedBy}.`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

client.on('guildBanAdd', ban => {
  const embed = new EmbedBuilder()
    .setColor('#e11d48')
    .setDescription(`🔨 <@${ban.user.id}> was banned.`)
    .setTimestamp();
  sendEmbedLog(embed, ban.guild);
});

client.on('guildBanRemove', ban => {
  const embed = new EmbedBuilder()
    .setColor('#4ade80')
    .setDescription(`⚖️ <@${ban.user.id}> was unbanned.`)
    .setTimestamp();
  sendEmbedLog(embed, ban.guild);
});

// 3. Username / Avatar Update
client.on('userUpdate', async (oldUser, newUser) => {
  const guilds = client.guilds.cache.filter(g => g.members.cache.has(newUser.id));
  if (oldUser.avatar !== newUser.avatar) {
    guilds.forEach(g => {
      const embed = new EmbedBuilder()
        .setColor('#3b82f6')
        .setDescription(`🖼️ <@${newUser.id}> updated their avatar.`)
        .setImage(newUser.displayAvatarURL({ size: 512 }))
        .setTimestamp();
      sendEmbedLog(embed, g);
    });
  }
  if (oldUser.username !== newUser.username) {
    guilds.forEach(g => {
      const embed = new EmbedBuilder()
        .setColor('#6366f1')
        .setDescription(`✏️ <@${newUser.id}> changed username from **${oldUser.username}** to **${newUser.username}**`)
        .setTimestamp();
      sendEmbedLog(embed, g);
    });
  }
});

// === PART 2 ===


// === VOICE CHANNEL EVENTS ===
client.on('voiceStateUpdate', async (oldState, newState) => {
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  if (oldChannel !== newChannel) {
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setDescription(`🔁 <@${newState.id}> moved voice channel:
From ${oldChannel ? `<#${oldChannel.id}>` : '*none*'} to ${newChannel ? `<#${newChannel.id}>` : '*none*'}`)
      .setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }

  const changes = [];
  if (oldState.serverMute !== newState.serverMute) changes.push(`Server mute → ${newState.serverMute}`);
  if (oldState.serverDeaf !== newState.serverDeaf) changes.push(`Server deaf → ${newState.serverDeaf}`);
  if (oldState.selfMute !== newState.selfMute) changes.push(`Self mute → ${newState.selfMute}`);
  if (oldState.selfDeaf !== newState.selfDeaf) changes.push(`Self deaf → ${newState.selfDeaf}`);

  if (changes.length > 0) {
    const embed = new EmbedBuilder()
      .setColor('#fb923c')
      .setDescription(`🔊 Voice state changed for <@${newState.id}>:
${changes.join('
')}`)
      .setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }
});

// === ROLE CREATED / DELETED ===
client.on('roleCreate', async role => {
  const embed = new EmbedBuilder()
    .setColor('#22c55e')
    .setDescription(`➕ Role created: <@&${role.id}>`)
    .setTimestamp();
  sendEmbedLog(embed, role.guild);
});

client.on('roleDelete', async role => {
  const embed = new EmbedBuilder()
    .setColor('#ef4444')
    .setDescription(`➖ Role deleted: **${role.name}**`)
    .setTimestamp();
  sendEmbedLog(embed, role.guild);
});

// === CHANNEL CREATED / DELETED ===
client.on('channelCreate', async channel => {
  const embed = new EmbedBuilder()
    .setColor('#22d3ee')
    .setDescription(`📢 Channel created: <#${channel.id}> (${channel.type})`)
    .setTimestamp();
  sendEmbedLog(embed, channel.guild);
});

client.on('channelDelete', async channel => {
  const embed = new EmbedBuilder()
    .setColor('#e11d48')
    .setDescription(`🗑️ Channel deleted: **${channel.name}** (${channel.type})`)
    .setTimestamp();
  sendEmbedLog(embed, channel.guild);
});

// === EMOJI & STICKER EVENTS ===
client.on('emojiCreate', emoji => {
  const embed = new EmbedBuilder()
    .setColor('#fde047')
    .setDescription(`😀 Emoji created: ${emoji.toString()} \`:${emoji.name}:\``)
    .setTimestamp();
  sendEmbedLog(embed, emoji.guild);
});

client.on('emojiDelete', emoji => {
  const embed = new EmbedBuilder()
    .setColor('#f97316')
    .setDescription(`❌ Emoji deleted: \`:${emoji.name}:\``)
    .setTimestamp();
  sendEmbedLog(embed, emoji.guild);
});

client.on('stickerCreate', sticker => {
  const embed = new EmbedBuilder()
    .setColor('#4ade80')
    .setDescription(`🖼️ Sticker created: **${sticker.name}**`)
    .setTimestamp();
  sendEmbedLog(embed, sticker.guild);
});

client.on('stickerDelete', sticker => {
  const embed = new EmbedBuilder()
    .setColor('#f43f5e')
    .setDescription(`🧽 Sticker deleted: **${sticker.name}**`)
    .setTimestamp();
  sendEmbedLog(embed, sticker.guild);
});

// === WEBHOOK EVENTS (audit log) ===
client.on('webhookUpdate', async channel => {
  const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate });
  const entry = logs.entries.first();
  if (entry) {
    const embed = new EmbedBuilder()
      .setColor('#6366f1')
      .setDescription(`🪝 Webhook updated in <#${channel.id}> by <@${entry.executor.id}>`)
      .setTimestamp();
    sendEmbedLog(embed, channel.guild);
  }
});

// === SERVER SETTINGS CHANGE (name, icon, banner) ===
client.on('guildUpdate', async (oldGuild, newGuild) => {
  const changes = [];
  if (oldGuild.name !== newGuild.name) changes.push(`📛 Name: ${oldGuild.name} → ${newGuild.name}`);
  if (oldGuild.icon !== newGuild.icon) changes.push(`🖼️ Icon changed.`);
  if (oldGuild.banner !== newGuild.banner) changes.push(`🎴 Banner changed.`);
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`💤 AFK Channel changed.`);
  if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push(`💬 System Channel changed.`);
  if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) changes.push(`📜 Rules Channel changed.`);

  if (changes.length > 0) {
    const embed = new EmbedBuilder()
      .setColor('#fcd34d')
      .setTitle('⚙️ Server settings updated')
      .setDescription(changes.join('
'))
      .setTimestamp();
    sendEmbedLog(embed, newGuild);
  }
});

client.login(process.env.TOKEN);
