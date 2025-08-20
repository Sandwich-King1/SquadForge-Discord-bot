
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { handleSetupCommand } from '../interactions.js';

export const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup SquadForge for your server'),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

        // Check if user has admin permissions
        if (!isServerAdmin && !isBotAdmin) {
            await interaction.reply({ 
                content: '**You are not admin for this server**\nPlease contact an admin to set up SquadForge', 
                ephemeral: true 
            });
            return;
        }

        // Use the same setup logic from interactions.js
        await handleSetupCommand(interaction);
    },
};
