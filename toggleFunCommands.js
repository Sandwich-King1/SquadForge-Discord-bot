
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { saveFunCommandState } from '../storage.js';

export const toggleFunCommandsCommand = {
    data: new SlashCommandBuilder()
        .setName('toggle_fun_commands')
        .setDescription('Enable or disable fun commands (jokes, cat, dog, dictionary)')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Which fun command to toggle')
                .setRequired(true)
                .addChoices(
                    { name: 'Jokes', value: 'joke' },
                    { name: 'Cat Pictures', value: 'cat' },
                    { name: 'Dog Pictures', value: 'dog' },
                    { name: 'Dictionary', value: 'dictionary' },
                    { name: 'All Fun Commands', value: 'all' }
                ))
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Enable or disable the command')
                .setRequired(true)
                .addChoices(
                    { name: 'Enable', value: 'enable' },
                    { name: 'Disable', value: 'disable' }
                )),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const command = interaction.options.getString('command');
        const status = interaction.options.getString('status');

        const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

        // Check if user has admin permissions
        if (!isServerAdmin && !isBotAdmin) {
            await interaction.reply({
                content: '**You are not admin for this server**\nPlease contact an admin to toggle fun commands',
                ephemeral: true
            });
            return;
        }

        // Initialize disabled commands storage if it doesn't exist
        if (!global.disabledFunCommands) {
            global.disabledFunCommands = {};
        }
        if (!global.disabledFunCommands[guildId]) {
            global.disabledFunCommands[guildId] = new Set();
        }

        const disabledCommands = global.disabledFunCommands[guildId];
        const isEnabled = status === 'enable';

        if (command === 'all') {
            const allCommands = ['joke', 'cat', 'dog', 'dictionary'];

            if (isEnabled) {
                // Enable all commands
                for (const cmd of allCommands) {
                    disabledCommands.delete(cmd);
                    await saveFunCommandState(guildId, cmd, false);
                }
                await interaction.reply({
                    content: '✅ **All fun commands have been enabled!**\nMembers can now use `/joke`, `/cat`, `/dog`, and `/dictionary` commands.',
                    ephemeral: true
                });
            } else {
                // Disable all commands
                for (const cmd of allCommands) {
                    disabledCommands.add(cmd);
                    await saveFunCommandState(guildId, cmd, true);
                }
                await interaction.reply({
                    content: '❌ **All fun commands have been disabled!**\nMembers can no longer use `/joke`, `/cat`, `/dog`, and `/dictionary` commands.',
                    ephemeral: true
                });
            }
        } else {
            const commandNames = {
                joke: 'Jokes',
                cat: 'Cat Pictures',
                dog: 'Dog Pictures',
                dictionary: 'Dictionary'
            };

            if (isEnabled) {
                disabledCommands.delete(command);
                await saveFunCommandState(guildId, command, false);
                await interaction.reply({
                    content: `✅ **${commandNames[command]} command has been enabled!**\nMembers can now use the \`/${command}\` command.`,
                    ephemeral: true
                });
            } else {
                disabledCommands.add(command);
                await saveFunCommandState(guildId, command, true);
                await interaction.reply({
                    content: `❌ **${commandNames[command]} command has been disabled!**\nMembers can no longer use the \`/${command}\` command.`,
                    ephemeral: true
                });
            }
        }
    }
};
