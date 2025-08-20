
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';

export const botAdminCommand = {
  data: new SlashCommandBuilder()
    .setName('bot_admin')
    .setDescription('Manage bot admin permissions')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Grant bot admin to a user'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Revoke bot admin from a user'))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List current bot admins')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Only server admins can manage bot admins.', ephemeral: true });
    }

    // In-memory store (replace with DB later)
    if (!global.botAdminsByGuildId) {
      global.botAdminsByGuildId = {};
    }
    if (!global.botAdminsByGuildId[guildId]) {
      global.botAdminsByGuildId[guildId] = new Set();
    }

    const adminSet = global.botAdminsByGuildId[guildId];

    if (sub === 'add') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('bot_admin_add_user')
        .setPlaceholder('Select a user to grant bot admin')
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(userSelect);

      return interaction.reply({ 
        content: 'Select a user to grant bot admin permissions:', 
        components: [row], 
        ephemeral: true 
      });
    }

    if (sub === 'remove') {
      if (adminSet.size === 0) {
        return interaction.reply({ content: '❌ No bot admins to remove.', ephemeral: true });
      }

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('bot_admin_remove_user')
        .setPlaceholder('Select a user to remove bot admin')
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(userSelect);

      return interaction.reply({ 
        content: 'Select a user to remove bot admin permissions:', 
        components: [row], 
        ephemeral: true 
      });
    }

    if (sub === 'list') {
      if (adminSet.size === 0) {
        return interaction.reply({ content: '📋 No bot admins configured for this server.', ephemeral: true });
      }

      const adminList = Array.from(adminSet).map(id => `<@${id}>`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Bot Admins')
        .setDescription(adminList)
        .setColor(0x0099ff)
        .setFooter({ text: `Total: ${adminSet.size} bot admin(s)` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
