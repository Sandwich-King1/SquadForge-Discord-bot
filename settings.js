
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { handleSettingsCommand } from '../interactions.js';

export const settingsCommand = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure advanced SquadForge settings'),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

        // Check if user has admin permissions
        if (!isServerAdmin && !isBotAdmin) {
            await interaction.reply({ 
                content: '**You are not admin for this server**\nPlease contact an admin to access settings', 
                ephemeral: true 
            });
            return;
        }

        // Use the settings logic from interactions.js
        await handleSettingsCommand(interaction);
    }
};
