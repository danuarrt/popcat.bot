// Discord Server Logger Bot - Full Logging System
import { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent, PermissionsBitField } from 'discord.js';
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
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Helper to send embed to log channel
async function sendEmbedLog(embed, guild) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  try {
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('Log error:', e);
  }
}

// Ready log
client.once('ready', () => {
  console.log(`â Logged in as ${client.user.tag}`);
});

// Message Create
client.on('messageCreate', message => {
  if (!message.guild || message.author.bot) return;
  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setAuthor({ name: `${message.author.tag} (${message.author.id})`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`ð¬ Message sent in <#${message.channel.id}> [Jump](${message.url})`)
    .addFields({ name: 'Content', value: message.content || '*No content*' })
    .setTimestamp();
  sendEmbedLog(embed, message.guild);
});

// Message Update
client.on('messageUpdate', (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.partial || newMsg.partial || oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setColor('#facc15')
    .setAuthor({ name: `${oldMsg.author.tag} (${oldMsg.author.id})`, iconURL: oldMsg.author.displayAvatarURL() })
    .setDescription(`âï¸ Message edited in <#${oldMsg.channel.id}> [Jump](${newMsg.url})`)
    .addFields(
      { name: 'Before', value: oldMsg.content || '*No content*' },
      { name: 'After', value: newMsg.content || '*No content*' }
    )
    .setTimestamp();
  sendEmbedLog(embed, oldMsg.guild);
});

// Message Delete
client.on('messageDelete', message => {
  if (!message.guild || message.partial) return;
  const embed = new EmbedBuilder()
    .setColor('#ef4444')
    .setAuthor({ name: `${message.author?.tag ?? 'Unknown'} (${message.author?.id ?? 'N/A'})`, iconURL: message.author?.displayAvatarURL() ?? null })
    .setDescription(`ðï¸ Message deleted in <#${message.channel.id}>`)
    .addFields({ name: 'Content', value: message.content || '*No content*' })
    .setTimestamp();
  sendEmbedLog(embed, message.guild);
});

// Member Join/Leave
client.on('guildMemberAdd', member => {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setDescription(`ð¢ <@${member.id}> joined the server.`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

client.on('guildMemberRemove', member => {
  const embed = new EmbedBuilder()
    .setColor('Red')
    .setDescription(`ð´ <@${member.id}> left the server.`)
    .setTimestamp();
  sendEmbedLog(embed, member.guild);
});

// Voice Channel Logs
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setDescription(`ð <@${newState.id}> moved VC:
From **${oldState.channel?.name || 'None'}** to **${newState.channel?.name || 'None'}**`)
      .setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }
});

// Role Update
client.on('roleUpdate', async (oldRole, newRole) => {
  const diffs = [];
  if (oldRole.color !== newRole.color) diffs.push(`Color: ${oldRole.hexColor} â ${newRole.hexColor}`);
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    const oldPerms = new PermissionsBitField(oldRole.permissions.bitfield).toArray();
    const newPerms = new PermissionsBitField(newRole.permissions.bitfield).toArray();
    const added = newPerms.filter(p => !oldPerms.includes(p));
    const removed = oldPerms.filter(p => !newPerms.includes(p));
    if (added.length) diffs.push(`â Added: ${added.join(', ')}`);
    if (removed.length) diffs.push(`â Removed: ${removed.join(', ')}`);
  }
  if (!diffs.length) return;
  const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
  const entry = logs.entries.first();
  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(`âï¸ Role updated: <@&${newRole.id}>`)
    .setDescription(diffs.join('
'))
    .addFields({ name: 'By', value: entry ? `<@${entry.executor.id}>` : 'Unknown', inline: true })
    .setTimestamp();
  sendEmbedLog(embed, newRole.guild);
});

client.login(process.env.TOKEN);
