
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isBotAdmin } from '../isBotAdmin.js';

export const moderatorRoleCommand = {
  data: new SlashCommandBuilder()
    .setName('moderator_role')
    .setDescription('Manage moderator roles for SquadForge')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a moderator role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to add as moderator')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a moderator role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to remove from moderators')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all moderator roles')
    ),

  async execute(interaction) {
    if (!isBotAdmin(interaction)) {
      await interaction.reply({
        content: '❌ You need bot admin permissions to use this command.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
      const { addModeratorRole, removeModeratorRole } = await import('../storage.js');
      
      if (subcommand === 'add') {
        const role = interaction.options.getRole('role');
        await addModeratorRole(guildId, role.id);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Moderator Role Added')
          .setDescription(`${role} has been added as a moderator role.`)
          .setColor(0x00ff00);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
      } else if (subcommand === 'remove') {
        const role = interaction.options.getRole('role');
        await removeModeratorRole(guildId, role.id);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Moderator Role Removed')
          .setDescription(`${role} has been removed from moderator roles.`)
          .setColor(0x00ff00);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
      } else if (subcommand === 'list') {
        const moderatorRoles = global.moderatorRolesByGuildId?.[guildId];
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Moderator Roles')
          .setColor(0x0099ff);
        
        if (!moderatorRoles || moderatorRoles.size === 0) {
          embed.setDescription('No moderator roles configured.');
        } else {
          const roleList = Array.from(moderatorRoles)
            .map(roleId => `<@&${roleId}>`)
            .join('\n');
          embed.setDescription(roleList);
        }
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      console.error('Error in moderator role command:', error);
      await interaction.reply({
        content: '❌ An error occurred while managing moderator roles.',
        ephemeral: true
      });
    }
  }
};
