import { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// MEMBER JOIN / LEAVE
client.on('guildMemberAdd', member => {
  sendLog({
    title: '🟢 Member Joined',
    description: `<@${member.id}> joined the server.\n**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
    guild: member.guild
  });
});
client.on('guildMemberRemove', member => {
  sendLog({
    title: '🔴 Member Left',
    description: `<@${member.id}> left the server.\n**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
    guild: member.guild
  });
});

// ROLE ADD / REMOVE
client.on('guildMemberUpdate', (oldMember, newMember) => {
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  added.forEach(role =>
    sendLog({
      title: '➕ Role Added',
      description: `Role **${role.name}** added to <@${newMember.id}> (${newMember.id})`,
      guild: newMember.guild
    })
  );
  removed.forEach(role =>
    sendLog({
      title: '➖ Role Removed',
      description: `Role **${role.name}** removed from <@${newMember.id}> (${newMember.id})`,
      guild: newMember.guild
    })
  );
});

// MESSAGE CREATE
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  sendLog({
    title: '📝 Message Sent',
    description: `**Author:** <@${message.author.id}> (${message.author.id})\n**Channel:** <#${message.channel.id}>\n[Jump to Message](${message.url})\n\n**Content:**\n\`\`\`${message.content || '[Embed/Attachment]'}\`\`\``,
    guild: message.guild
  });
});

// MESSAGE EDIT
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;

  sendLog({
    title: '✏️ Message Edited',
    description: `**Author:** <@${oldMsg.author.id}> (${oldMsg.author.id})\n**Channel:** <#${oldMsg.channel.id}>\n[Jump to Message](${newMsg.url})\n\n**Before:**\n\`\`\`${oldMsg.content || '[Empty]'}\`\`\`\n**After:**\n\`\`\`${newMsg.content || '[Empty]'}\`\`\``,
    guild: oldMsg.guild
  });
});

// MESSAGE DELETE
client.on('messageDelete', async message => {
  if (!message.guild || message.partial || message.author?.bot) return;
  sendLog({
    title: '🗑️ Message Deleted',
    description: `**Author:** <@${message.author.id}> (${message.author.id})\n**Channel:** <#${message.channel.id}>\n\n**Content:**\n\`\`\`${message.content || '[Embed/Attachment]'}\`\`\``,
    guild: message.guild
  });
});

// CHANNEL RENAME / CREATE / DELETE
client.on('channelUpdate', (oldCh, newCh) => {
  if (oldCh.name !== newCh.name) {
    sendLog({
      title: '🔁 Channel Renamed',
      description: `**Old Name:** ${oldCh.name}\n**New Name:** ${newCh.name}`,
      guild: newCh.guild
    });
  }
});
client.on('channelCreate', channel => {
  sendLog({
    title: '📁 Channel Created',
    description: `New channel <#${channel.id}> (${channel.name}) created.`,
    guild: channel.guild
  });
});
client.on('channelDelete', channel => {
  sendLog({
    title: '❌ Channel Deleted',
    description: `Channel **${channel.name}** (${channel.id}) was deleted.`,
    guild: channel.guild
  });
});

// BAN / UNBAN
client.on('guildBanAdd', ban => {
  sendLog({
    title: '🔨 Member Banned',
    description: `<@${ban.user.id}> was banned.\n**Tag:** ${ban.user.tag}\n**ID:** ${ban.user.id}`,
    guild: ban.guild
  });
});
client.on('guildBanRemove', ban => {
  sendLog({
    title: '⚖️ Member Unbanned',
    description: `<@${ban.user.id}> was unbanned.\n**Tag:** ${ban.user.tag}\n**ID:** ${ban.user.id}`,
    guild: ban.guild
  });
});

// EMOJI CREATE / DELETE / UPDATE
client.on('emojiCreate', emoji => {
  sendLog({
    title: '🆕 Emoji Added',
    description: `New emoji added: ${emoji} \`${emoji.name}\` (${emoji.id})`,
    guild: emoji.guild
  });
});
client.on('emojiDelete', emoji => {
  sendLog({
    title: '❌ Emoji Removed',
    description: `Emoji removed: \`${emoji.name}\` (${emoji.id})`,
    guild: emoji.guild
  });
});
client.on('emojiUpdate', (oldEmoji, newEmoji) => {
  if (oldEmoji.name !== newEmoji.name) {
    sendLog({
      title: '🔁 Emoji Renamed',
      description: `Emoji renamed from \`${oldEmoji.name}\` to \`${newEmoji.name}\` (${newEmoji.id})`,
      guild: newEmoji.guild
    });
  }
});

// WEBHOOK CREATE / DELETE / UPDATE
client.on('webhookUpdate', async channel => {
  const webhooks = await channel.fetchWebhooks();
  webhooks.forEach(webhook => {
    sendLog({
      title: '🔧 Webhook Updated',
      description: `Webhook updated in <#${channel.id}>: \`${webhook.name}\` (${webhook.id})`,
      guild: channel.guild
    });
  });
});

// Send embed log
async function sendLog({ title, description, guild }) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
}

client.login(process.env.TOKEN);
