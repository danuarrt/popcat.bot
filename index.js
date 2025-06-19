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
  sendLog(`🟢 **${member.user.tag}** joined the server.`, member.guild);
});
client.on('guildMemberRemove', member => {
  sendLog(`🔴 **${member.user.tag}** left the server.`, member.guild);
});

// ROLE ADD / REMOVE
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  added.forEach(role => sendLog(`➕ Role **${role.name}** added to **${newMember.user.tag}**.`, newMember.guild));
  removed.forEach(role => sendLog(`➖ Role **${role.name}** removed from **${newMember.user.tag}**.`, newMember.guild));
});

// MESSAGE DELETE
client.on('messageDelete', async message => {
  if (!message.guild || message.partial) return;
  sendLog(`🗑️ Message deleted in <#${message.channel.id}> by **${message.author.tag}**:\n\`\`\`${message.content}\`\`\``, message.guild);
});

// MESSAGE EDIT
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!oldMsg.content || !newMsg.content || oldMsg.content === newMsg.content) return;
  sendLog(`✏️ Message edited in <#${oldMsg.channel.id}> by **${oldMsg.author.tag}**:\n**Before:**\n\`\`\`${oldMsg.content}\`\`\`\n**After:**\n\`\`\`${newMsg.content}\`\`\``, oldMsg.guild);
});

// CHANNEL UPDATE
client.on('channelUpdate', (oldCh, newCh) => {
  if (oldCh.name !== newCh.name) {
    sendLog(`🔁 Channel renamed from **${oldCh.name}** to **${newCh.name}**`, newCh.guild);
  }
});

// BAN
client.on('guildBanAdd', async ban => {
  sendLog(`🔨 **${ban.user.tag}** was banned.`, ban.guild);
});

// UNBAN
client.on('guildBanRemove', async ban => {
  sendLog(`⚖️ **${ban.user.tag}** was unbanned.`, ban.guild);
});

async function sendLog(content, guild) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setDescription(content)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
}

client.login(process.env.TOKEN);
