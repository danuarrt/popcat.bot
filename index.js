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
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// MEMBER JOIN / LEAVE
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

// ROLE ADD / REMOVE
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

// MESSAGE DELETE
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
    embed.setImage(attachments.split('\n')[0]); // Show 1st image
  }

  sendEmbedLog(embed, message.guild);
});

// MESSAGE EDIT
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

// CHANNEL UPDATE (name only)
client.on('channelUpdate', (oldCh, newCh) => {
  if (oldCh.name !== newCh.name) {
    const embed = new EmbedBuilder()
      .setColor('#00bcd4')
      .setDescription(`🔁 Channel renamed from **${oldCh.name}** to **${newCh.name}**`)
      .setTimestamp();
    sendEmbedLog(embed, newCh.guild);
  }
});

// BAN / UNBAN
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

// SEND TO LOG CHANNEL
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
