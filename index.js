import { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent, Events, PermissionsBitField } from 'discord.js';
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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Utility: Send to log channel
async function sendEmbedLog(embed, guild) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  try {
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('Log error:', e);
  }
}

// Voice state updates
client.on('voiceStateUpdate', async (oldState, newState) => {
  const user = `<@${newState.id}>`;

  if (oldState.channelId !== newState.channelId) {
    const from = oldState.channel?.name || 'none';
    const to = newState.channel?.name || 'none';
    const embed = new EmbedBuilder().setColor('#8b5cf6').setDescription(`🔁 ${user} moved voice channel:
**From:** ${from}
**To:** ${to}`).setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }

  const changes = [];
  if (oldState.selfMute !== newState.selfMute) changes.push(`Self-mute: ${newState.selfMute}`);
  if (oldState.selfDeaf !== newState.selfDeaf) changes.push(`Self-deafen: ${newState.selfDeaf}`);
  if (oldState.serverMute !== newState.serverMute) changes.push(`Server-mute: ${newState.serverMute}`);
  if (oldState.serverDeaf !== newState.serverDeaf) changes.push(`Server-deafen: ${newState.serverDeaf}`);

  if (changes.length) {
    let actorInfo = '';
    const logs = await newState.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
    const entry = logs.entries.find(e => e.target.id === newState.id);
    if (entry) actorInfo = ` by <@${entry.executor.id}>`;

    const embed = new EmbedBuilder().setColor('#ff00ff').setDescription(`🔇 Voice state changed for ${user}${actorInfo}
${changes.join('\n')}`).setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }
});

// Role update/create/delete
client.on('roleUpdate', async (oldRole, newRole) => {
  const changes = [];
  if (oldRole.color !== newRole.color) changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    const oldPerms = oldRole.permissions.toArray();
    const newPerms = newRole.permissions.toArray();
    const added = newPerms.filter(p => !oldPerms.includes(p));
    const removed = oldPerms.filter(p => !newPerms.includes(p));
    if (added.length) changes.push(`➕ Added: ${added.join(', ')}`);
    if (removed.length) changes.push(`➖ Removed: ${removed.join(', ')}`);
  }
  if (!changes.length) return;

  const logs = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
  const entry = logs.entries.first();

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(`⚙️ Role updated: <@&${newRole.id}>`)
    .setDescription(changes.join('\n'))
    .addFields({ name: 'By', value: entry ? `<@${entry.executor.id}>` : 'Unknown' })
    .setTimestamp();
  sendEmbedLog(embed, newRole.guild);
});

client.on('roleCreate', async role => {
  const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
  const entry = logs.entries.first();
  const embed = new EmbedBuilder().setColor('#22c55e').setDescription(`➕ Role <@&${role.id}> created by <@${entry.executor.id}>`).setTimestamp();
  sendEmbedLog(embed, role.guild);
});

client.on('roleDelete', async role => {
  const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
  const entry = logs.entries.first();
  const embed = new EmbedBuilder().setColor('#ef4444').setDescription(`🗑️ Role **${role.name}** deleted by <@${entry.executor.id}>`).setTimestamp();
  sendEmbedLog(embed, role.guild);
});

// Channel create/delete
client.on('channelCreate', async ch => {
  const logs = await ch.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
  const entry = logs.entries.first();
  const embed = new EmbedBuilder().setColor('#0ea5e9').setDescription(`➕ Channel <#${ch.id}> created by <@${entry.executor.id}>`).setTimestamp();
  sendEmbedLog(embed, ch.guild);
});

client.on('channelDelete', async ch => {
  const logs = await ch.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
  const entry = logs.entries.first();
  const embed = new EmbedBuilder().setColor('#dc2626').setDescription(`🗑️ Channel **${ch.name}** deleted by <@${entry.executor.id}>`).setTimestamp();
  sendEmbedLog(embed, ch.guild);
});

// Emoji/sticker events
client.on('emojiCreate', emoji => {
  const embed = new EmbedBuilder().setColor('#fbbf24').setDescription(`🆕 Emoji added: ${emoji}`).setTimestamp();
  sendEmbedLog(embed, emoji.guild);
});

client.on('emojiDelete', emoji => {
  const embed = new EmbedBuilder().setColor('#e11d48').setDescription(`🗑️ Emoji deleted: **${emoji.name}**`).setTimestamp();
  sendEmbedLog(embed, emoji.guild);
});

client.on('stickerCreate', sticker => {
  const embed = new EmbedBuilder().setColor('#fbbf24').setDescription(`🆕 Sticker added: **${sticker.name}**`).setTimestamp();
  sendEmbedLog(embed, sticker.guild);
});

client.on('stickerDelete', sticker => {
  const embed = new EmbedBuilder().setColor('#e11d48').setDescription(`🗑️ Sticker deleted: **${sticker.name}**`).setTimestamp();
  sendEmbedLog(embed, sticker.guild);
});

// Webhook update
client.on('webhookUpdate', async (ch) => {
  const logs = await ch.guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 });
  const entry = logs.entries.first();
  if (entry) {
    const embed = new EmbedBuilder().setColor('#f43f5e').setDescription(`📡 Webhook updated in <#${ch.id}> by <@${entry.executor.id}>`).setTimestamp();
    sendEmbedLog(embed, ch.guild);
  }
});

// Mass ping detection
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot) return;
  const mentionCount = (msg.content.match(/<@!?\d+>/g) || []).length;
  if (mentionCount >= 5) {
    const embed = new EmbedBuilder().setColor('#f87171').setDescription(`🚨 Mass ping detected by <@${msg.author.id}> (${mentionCount} mentions)`).setTimestamp();
    sendEmbedLog(embed, msg.guild);
  }
});

client.login(process.env.TOKEN);
