
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { handleRefreshCommand } from '../interactions.js';

export const refreshCommand = {
    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Refresh the queue creation message'),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

        // Check if user has admin permissions
        if (!isBotAdmin && !isServerAdmin) {
            await interaction.reply({ 
                content: '**You are not admin for this server**\nPlease contact an admin to refresh SquadForge', 
                ephemeral: true 
            });
            return;
        }

        // Use the refresh logic from interactions.js
        await handleRefreshCommand(interaction);
    },
};
