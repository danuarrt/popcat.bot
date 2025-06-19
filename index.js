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
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ------------- VOICE CHANNEL ------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId !== newState.channelId) {
    const before = oldState.channel?.name ? `<#${oldState.channel.id}>` : 'none';
    const after = newState.channel?.name ? `<#${newState.channel.id}>` : 'none';
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setDescription(`🔁 <@${newState.id}> moved voice channel:\nFrom **${before}** to **${after}**`)
      .setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }

  // Mute/deafen
  const changes = [];
  if (oldState.selfMute !== newState.selfMute) changes.push(`Self-mute → ${newState.selfMute}`);
  if (oldState.selfDeaf !== newState.selfDeaf) changes.push(`Self-deafen → ${newState.selfDeaf}`);
  if (oldState.serverMute !== newState.serverMute) changes.push(`Server-mute → ${newState.serverMute}`);
  if (oldState.serverDeaf !== newState.serverDeaf) changes.push(`Server-deafen → ${newState.serverDeaf}`);

  if (changes.length) {
    // Who caused server-mute/deaf?
    let actorInfo = '';
    if (changes.some(c => c.startsWith('Server-'))) {
      const logs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
      const entry = logs.entries.first();
      if (entry?.target.id === newState.id) actorInfo = ` by <@${entry.executor.id}>`;
    }
    const embed = new EmbedBuilder()
      .setColor('#ff00ff')
      .setDescription(`🔇 Voice state changed for <@${newState.id}>${actorInfo}\n${changes.join('\n')}`)
      .setTimestamp();
    sendEmbedLog(embed, newState.guild);
  }
});

// ------------ PERMISSION & ROLE COLOR ------------
client.on('roleUpdate', async (oldRole, newRole) => {
  const diffs = [];
  if (oldRole.color !== newRole.color) diffs.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) diffs.push(`Permissions changed`);
  if (!diffs.length) return;

  const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
  const entry = logs.entries.first();

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(`⚙️ Role updated: ${newRole.name}`)
    .setDescription(diffs.join('\n'))
    .addFields(
      { name: 'By', value: entry ? `<@${entry.executor.id}>` : 'Unknown', inline: true }
    )
    .setTimestamp();
  sendEmbedLog(embed, newRole.guild);
});

// --------- INVITE CREATED ----------
client.on('inviteCreate', async invite => {
  const logs = await invite.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.InviteCreate });
  const entry = logs.entries.first();

  const embed = new EmbedBuilder()
    .setColor('#10b981')
    .setDescription(`🔗 Invite created by <@${entry.executor.id}>:\n**Code:** ${invite.code}\n**Channel:** ${invite.channel?.name}`)
    .setTimestamp();
  sendEmbedLog(embed, invite.guild);
});

// -------- USER AVATAR & USERNAME CHANGE ----------
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
    const logs = guilds.first()?.fetchAuditLogs({ limit: 1, type: AuditLogEvent.UserUpdate });
    const executor = (await logs).entries.first().executor?.id;
    guilds.forEach(g => {
      const embed = new EmbedBuilder()
        .setColor('#6366f1')
        .setDescription(`✏️ <@${newUser.id}> changed username 📝\nFrom **${oldUser.username}** to **${newUser.username}**${executor && executor !== newUser.id ? ` by <@${executor}>` : ''}`)
        .setTimestamp();
      sendEmbedLog(embed, g);
    });
  }
});

// -------- EXISTING LOGS ----------
import './existingLogs'; // (Jika kamu simpan logs sebelumnya di file)


// ---------------- SEND TO LOG CHANNEL --------------
async function sendEmbedLog(embed, guild) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  try {
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('Log error:', e);
  }
}

client.login(process.env.TOKEN);
