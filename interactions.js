import { Client, GatewayIntentBits, InteractionType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { saveGuildSettings, getGuildSettings, saveGamePresets, saveRolePingConfiguration, removeRolePingConfiguration, getGamePresets, getRolePingConfigurations } from './storage.js';
import { isBotAdmin, isModerator } from './isBotAdmin.js';
import { getRandomTip } from './tips.js';
// button structure for setup message below

const continueSetup1 = new ButtonBuilder()
    .setCustomId('continue_setup1')
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary);

const backToStep1 = new ButtonBuilder()
    .setCustomId('back_to_step1')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

const backToStep3 = new ButtonBuilder()
    .setCustomId('back_to_step3')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

const backToStep2 = new ButtonBuilder()
    .setCustomId('back_to_step2')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

const continueToStep3 = new ButtonBuilder()
    .setCustomId('finish_setup')
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary);

const finishSetup = new ButtonBuilder()
    .setCustomId('finish_setup')
    .setLabel('Finish Setup')
    .setStyle(ButtonStyle.Success);

const continueToStep4 = new ButtonBuilder()
    .setCustomId('continue_to_step4')
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary);

const selectChannel = new ChannelSelectMenuBuilder()
    .setCustomId('selected_queue_channel')
    .setPlaceholder('Select a channel for queues')
    .addChannelTypes(ChannelType.GuildText);

const selectcategory = new ChannelSelectMenuBuilder()
    .setCustomId('selected_category')
    .setPlaceholder('Select a category for queue channels')
    .addChannelTypes(ChannelType.GuildCategory);

const configRole = new RoleSelectMenuBuilder()
    .setCustomId('selected_roles')
    .setPlaceholder('Select roles to get pinged')
    .setMaxValues(25);

// Simplified role ping configuration using modals instead of complex select menus
function createSimpleGameSelectMenuForRoles(guildId) {
    const selectGame = new StringSelectMenuBuilder()
        .setCustomId('selected_game_for_role_simple')
        .setPlaceholder('Select a game to configure role pings for')
        .setMaxValues(1);

    // Get game presets for this guild
    const guildPresets = gamePresets.get(guildId) || [];

    const options = [];

    // Add each game as a simple option
    guildPresets.forEach((game, gameIndex) => {
        // Create a simple label that's always at least 25 characters
        let label = game.name;
        if (label.length < 25) {
            label = `${label} - Configure Role Pings`;
        }
        if (label.length > 100) {
            label = label.substring(0, 97) + '...';
        }

        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(`game_${gameIndex}`)
                .setDescription(`Configure pings for ${game.name}`)
        );
    });

    // Add fallback option if no games
    if (options.length === 0) {
        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel('No games available - Add game presets first')
                .setValue('no_games')
                .setDescription('Add game presets to configure role pings')
        );
    }

    selectGame.addOptions(...options);
    return selectGame;
}

// This will be created dynamically based on game presets
function createGameSelectMenu(guildId) {
    const selectGame = new StringSelectMenuBuilder()
        .setCustomId('selected_game_ping')
        .setPlaceholder('Select a game to ping this role');

    // Get game presets for this guild
    const guildPresets = gamePresets.get(guildId) || [];

    if (guildPresets.length === 0) {
        selectGame.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('No games added yet')
                .setValue('no_games')
                .setDescription('Add games in setup first')
        );
    } else {
        // Add each game preset as an option
        guildPresets.forEach((game, index) => {
            selectGame.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(game.name)
                    .setValue(`game_${index}`)
                    .setDescription(game.modes.length > 0 ? `${game.modes.length} modes available` : 'No specific modes')
            );
        });
    }

    return selectGame;
}

// Configuration select menus for step 2
const maxQueuesSelect = new StringSelectMenuBuilder()
    .setCustomId('max_queues')
    .setPlaceholder('Select max queues (1-25)')
    .addOptions(
        Array.from({length: 25}, (_, i) => 
            new StringSelectMenuOptionBuilder()
                .setLabel(`${i + 1} queue${i === 0 ? '' : 's'}`)
                .setValue(`${i + 1}`)
        )
    );

const maxPlayersSelect = new StringSelectMenuBuilder()
    .setCustomId('max_players')
    .setPlaceholder('Select max players per queue (2-50)')
    .addOptions([
        new StringSelectMenuOptionBuilder().setLabel('2 players').setValue('2'),
        new StringSelectMenuOptionBuilder().setLabel('5 players').setValue('5'),
        new StringSelectMenuOptionBuilder().setLabel('8 players').setValue('8'),
        new StringSelectMenuOptionBuilder().setLabel('11 players').setValue('11'),
        new StringSelectMenuOptionBuilder().setLabel('14 players').setValue('14'),
        new StringSelectMenuOptionBuilder().setLabel('17 players').setValue('17'),
        new StringSelectMenuOptionBuilder().setLabel('20 players').setValue('20'),
        new StringSelectMenuOptionBuilder().setLabel('23 players').setValue('23'),
        new StringSelectMenuOptionBuilder().setLabel('26 players').setValue('26'),
        new StringSelectMenuOptionBuilder().setLabel('29 players').setValue('29'),
        new StringSelectMenuOptionBuilder().setLabel('32 players').setValue('32'),
        new StringSelectMenuOptionBuilder().setLabel('36 players').setValue('36'),
        new StringSelectMenuOptionBuilder().setLabel('40 players').setValue('40'),
        new StringSelectMenuOptionBuilder().setLabel('44 players').setValue('44'),
        new StringSelectMenuOptionBuilder().setLabel('50 players').setValue('50')
    ]);

const maxAvailabilitySelect = new StringSelectMenuBuilder()
    .setCustomId('max_availability')
    .setPlaceholder('Select max availability time (1-8 hours)')
    .addOptions(
        Array.from({length: 8}, (_, i) => 
            new StringSelectMenuOptionBuilder()
                .setLabel(`${i + 1} hour${i === 0 ? '' : 's'}`)
                .setValue(`${i + 1}`)
        )
    );

const setupRow1 = new ActionRowBuilder()
    .addComponents(selectChannel);

const setupRow2 = new ActionRowBuilder()
    .addComponents(selectcategory);

const setupRow3 = new ActionRowBuilder()
    .addComponents(continueSetup1);

// Step 2 rows
const setupRow4 = new ActionRowBuilder()
    .addComponents(maxQueuesSelect);

const setupRow5 = new ActionRowBuilder()
    .addComponents(maxPlayersSelect);

const setupRow6 = new ActionRowBuilder()
    .addComponents(maxAvailabilitySelect);

const setupRow7 = new ActionRowBuilder()
    .addComponents(backToStep1, continueToStep3);

// Export components for reuse
export { setupRow1, setupRow2, setupRow3, setupRow4, setupRow5, setupRow6, setupRow7, createGameSelectMenu, createSimpleGameSelectMenuForRoles };

// Store settings session data per guild
const settingsData = new Map();

// Export function to handle settings command
export async function handleSettingsCommand(interaction) {
    const guildId = interaction.guildId;
    const guildSettings = await getGuildSettings(guildId);

    if (!guildSettings) {
        await interaction.reply({
            content: '❌ Server not configured. Please run `/setup` first.',
            ephemeral: true
        });
        return;
    }

    // Initialize settings session
    if (!settingsData.has(guildId)) {
        settingsData.set(guildId, {});
    }
    settingsData.get(guildId).currentPage = 1;
    settingsData.get(guildId).tempGamePresets = [...(gamePresets.get(guildId) || [])];

    await showSettingsPage(interaction, 1);
}

// Helper function to create settings page embed
async function createSettingsPageEmbed(guildId, pageNumber) {
    const sessionData = settingsData.get(guildId);
    const currentGamePresets = sessionData?.tempGamePresets || gamePresets.get(guildId) || [];
    const guildSettings = await getGuildSettings(guildId);

    let embed;

    switch (pageNumber) {
        case 1:
            embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Settings - Page 1/4')
                .setDescription('**Game Presets Management**\nAdd or remove game presets and their modes.')
                .addFields(
                    {
                        name: '🎮 Current Game Presets',
                        value: currentGamePresets.length > 0 ? 
                            currentGamePresets.map((game, index) => 
                                `**${index + 1}.** ${game.name}${game.modes.length > 0 ? ` (${game.modes.length} modes)` : ''}`
                            ).join('\n') : 
                            'No game presets configured',
                        inline: false
                    },
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Use the buttons below to manage presets' });
            break;

        case 2:
            embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Settings - Page 2/4')
                .setDescription('**Advanced Settings**\nServer configuration and preferences.')
                .addFields(
                    {
                        name: '🚦 Queue Limit Behavior',
                        value: guildSettings ? 
                            `**Current Setting:** ${guildSettings.queue_limit_behavior === 'expire' ? 'Expire Mode' : 'Block Mode'}\n${guildSettings.queue_limit_behavior === 'expire' ? '• Allows new queues when at limit\n• Adds expiration timers to oldest queues\n• Auto-deletes queues when 3+ over limit' : '• Prevents new queue creation when at limit\n• Shows error message to users\n• Simple and predictable behavior'}` :
                            'Guild settings not found',
                        inline: false
                    },
                    {
                        name: '⚙️ Available Actions',
                        value: '• Configure queue limit behavior\n• Advanced server settings',
                        inline: false
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Configure how your server handles queue limits' });
            break;

        case 3:
            embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Settings - Page 3/4')
                .setDescription('**Queue Configuration**\nModify queue limits and behaviors.')
                .addFields(
                    {
                        name: '🔢 Current Settings',
                        value: guildSettings ? 
                            `**Max Queues:** ${guildSettings.max_queues}\n**Max Players:** ${guildSettings.max_players}\n**Max Availability:** ${guildSettings.max_availability} hours\n**Custom Queues:** ${guildSettings.allow_custom_queues ? 'Enabled' : 'Disabled'}` :
                            'Guild settings not found',
                        inline: false
                    },
                    {
                        name: '⚙️ Available Actions',
                        value: '• Modify queue limits\n• Toggle custom queues\n• Update availability time',
                        inline: false
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Configuration options coming soon!' });
            break;

        case 4:
            // Get current role ping configurations
            // const rolePingConfigs = await getRolePingConfigurations(guildId); //removed await
            // const configSummary = rolePingConfigs.length > 0 ? 
            //     rolePingConfigs.map(config => 
            //         `<@&${config.role_id}> → ${config.game_name}${config.game_mode ? ` (${config.game_mode})` : ' (All modes)'}`
            //     ).join('\n') : 'No role ping configurations set';
            const configSummary = 'Role ping configurations are not loaded.';

            embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Settings - Page 4/4')
                .setDescription('**Role Ping Management**\nAdd or remove role ping configurations for specific games and modes.')
                .addFields(
                    {
                        name: '👥 Current Role Ping Settings',
                        value: configSummary.length > 1024 ? configSummary.substring(0, 1020) + '...' : configSummary,
                        inline: false
                    },
                    {
                        name: '🎯 Available Actions',
                        value: '• Add role ping configuration\n• Remove role ping settings',
                        inline: false
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Configure which roles get pinged for specific games/modes' });
            break;

        default:
            embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Settings')
                .setDescription('Invalid page number.');
            break;
    }

    return embed;
}

// Helper function to create settings page components
function createSettingsPageComponents(pageNumber) {
    let components = [];

    switch (pageNumber) {
        case 1:
            const addPresetButton = new ButtonBuilder()
                .setCustomId('settings_add_preset')
                .setLabel('Add Game Preset')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➕');

            const addModeButton = new ButtonBuilder()
                .setCustomId('settings_add_mode')
                .setLabel('Add Mode to Game')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎯');

            const removePresetButton = new ButtonBuilder()
                .setCustomId('settings_remove_preset')
                .setLabel('Remove Game Preset')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const removeModeButton = new ButtonBuilder()
                .setCustomId('settings_remove_mode')
                .setLabel('Remove Mode')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const actionRow1 = new ActionRowBuilder().addComponents(addPresetButton, removePresetButton);
            const actionRow2 = new ActionRowBuilder().addComponents(addModeButton, removeModeButton);

            components = [actionRow1, actionRow2];
            break;

        case 4:
            const addRolePingButton = new ButtonBuilder()
                .setCustomId('settings_add_role_ping')
                .setLabel('Add Role Ping')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕');

            const removeRolePingButton = new ButtonBuilder()
                .setCustomId('settings_remove_role_ping')
                .setLabel('Remove Role Ping')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const rolePingActionRow = new ActionRowBuilder().addComponents(addRolePingButton, removeRolePingButton);
            components = [rolePingActionRow];
            break;

        default:
            break;
    }

    // Select menu for page navigation
    const settingsPageSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('settings_page_select')
        .setPlaceholder('Go to settings page...')
        .addOptions([
            new StringSelectMenuOptionBuilder().setLabel('Game Presets').setValue('1').setDescription('Manage game presets'),
            new StringSelectMenuOptionBuilder().setLabel('Advanced Settings').setValue('2').setDescription('Server preferences'),
            new StringSelectMenuOptionBuilder().setLabel('Queue Configuration').setValue('3').setDescription('Queue limits & behaviors'),
            new StringSelectMenuOptionBuilder().setLabel('Role Ping Management').setValue('4').setDescription('Configure role pings'),
        ]);

    const selectMenuRow = new ActionRowBuilder().addComponents(settingsPageSelectMenu);

    const saveButton = new ButtonBuilder()
        .setCustomId('settings_save')
        .setLabel('💾 Save Changes')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId('settings_cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(saveButton, cancelButton);

    components.push(selectMenuRow, actionRow);

    return components;
}

// Function to show settings page
async function showSettingsPage(interaction, pageNumber) {
    const guildId = interaction.guildId;
    const sessionData = settingsData.get(guildId);
    const currentGamePresets = sessionData?.tempGamePresets || gamePresets.get(guildId) || [];
    const guildSettings = await getGuildSettings(guildId);

    let embed = await createSettingsPageEmbed(guildId, pageNumber);
    let components = createSettingsPageComponents(pageNumber);

    // Update session data
    if (settingsData.has(guildId)) {
        settingsData.get(guildId).currentPage = pageNumber;
    }

    // Always edit the previous message for settings navigation
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    } else {
        // If not replied, defer the update and then edit
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await interaction.deferUpdate();
            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        } else {
            await interaction.reply({
                embeds: [embed],
                components: components,
                ephemeral: true
            });
        }
    }
}

// Export function to handle refresh command
export async function handleRefreshCommand(interaction) {
    const guildId = interaction.guildId;
    const guildSettings = await getGuildSettings(guildId);

    if (!guildSettings) {
        await interaction.reply({
            content: '❌ Server not configured. Please run `/setup` first.',
            ephemeral: true
        });
        return;
    }

    // Determine which channel to refresh based on system type
    let refreshChannelId = null;
    let channelName = '';

    if (guildSettings.system_type === 'single_channel') {
        refreshChannelId = guildSettings.single_channel_id;
        channelName = 'queue channel';
    } else if (guildSettings.system_type === 'two_channel') {
        refreshChannelId = guildSettings.creation_channel_id;
        channelName = 'queue creation channel';
    } else if (guildSettings.system_type === 'multi_channel') {
        refreshChannelId = guildSettings.queue_channel_id;
        channelName = 'queue channel';
    }

    if (!refreshChannelId) {
        await interaction.reply({
            content: '❌ No queue channel configured. Please run `/setup` again.',
            ephemeral: true
        });
        return;
    }

    // Check if channel exists
    const channel = interaction.client.channels.cache.get(refreshChannelId);
    if (!channel) {
        await interaction.reply({
            content: `❌ The configured ${channelName} (<#${refreshChannelId}>) no longer exists. Please run \`/setup\` again.`,
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const success = await refreshQueueCreationMessage(interaction.client, guildId, refreshChannelId);

    if (success) {
        await interaction.editReply({
            content: `✅ **Queue creation message refreshed successfully!**\n\n📍 **Channel:** <#${refreshChannelId}>\n🎮 **Game Presets:** ${gamePresets.get(guildId)?.length || 0}\n🔄 **System Type:** ${guildSettings.system_type.replace('_', '-')}`
        });
    } else {
        await interaction.editReply({
            content: `❌ **Failed to refresh queue creation message**\n\nThere was an issue refreshing the message in <#${refreshChannelId}>. Please check:\n• Bot has permission to send messages in that channel\n• The channel still exists\n• Try running \`/setup\` again if the problem persists`
        });
    }
}

// Export function to handle setup command
export async function handleSetupCommand(interaction) {
    const setupEmbed = new EmbedBuilder()
        .setTitle('⚙️ SquadForge Setup - Step 1 (Steps may vary)')
        .setDescription('Choose how you want your queue system to operate!')
        .addFields(
            {
                name: '🏗️ Queue System Types',
                value: 'Select the setup that best fits your server needs',
                inline: false
            },
            {
                name: '📋 Option Details',
                value: 'Each option provides different levels of organization and channel usage',
                inline: false
            }
        )
        .setColor(0x0099ff);

    const queueSystemSelect = new StringSelectMenuBuilder()
        .setCustomId('queue_system_type')
        .setPlaceholder('Choose your queue system type')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Multi-Channel System')
                .setValue('multi_channel')
                .setDescription('Separate channel for each queue + creation channel')
                .setEmoji('🏗️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Two-Channel System')
                .setValue('two_channel')
                .setDescription('One channel for queues + one for queue creation')
                .setEmoji('📋'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Single-Channel System')
                .setValue('single_channel')
                .setDescription('All queues and creation in one channel')
                .setEmoji('📝')
        );

    const systemTypeRow = new ActionRowBuilder().addComponents(queueSystemSelect);

    await interaction.reply({ 
        embeds: [setupEmbed],
        components: [systemTypeRow],
        ephemeral: true
    });
}

// Store game presets per guild
const gamePresets = new Map();

const addGameButton = new ButtonBuilder()
    .setCustomId('add_game_preset')
    .setLabel('Add Game')
    .setStyle(ButtonStyle.Primary);

const skipPresetsButton = new ButtonBuilder()
    .setCustomId('skip_presets')
    .setLabel('Skip This Step')
    .setStyle(ButtonStyle.Secondary);

// Step 3 Rows (Game Presets)
const setupRow8 = new ActionRowBuilder()
    .addComponents(addGameButton);

const setupRow9 = new ActionRowBuilder()
    .addComponents(backToStep2, skipPresetsButton, continueToStep4);

// Step 4 Rows (Role Game Mode config)
const setupRow10 = new ActionRowBuilder()
    .addComponents(configRole);

const skipRolePingButton = new ButtonBuilder()
    .setCustomId('skip_role_ping')
    .setLabel('Skip Role Ping')
    .setStyle(ButtonStyle.Secondary);

const continueToStep5 = new ButtonBuilder()
    .setCustomId('continue_to_step_5')
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary);

const setupRow11 = new ActionRowBuilder()
    .addComponents(backToStep3, continueToStep5);

const setupRow12 = new ActionRowBuilder()
    .addComponents(finishSetup);

// Custom Queue Permission Select Menu (Step 5 if applicable)
const allowCustomQueuesSelect = new StringSelectMenuBuilder()
    .setCustomId('allow_custom_queues')
    .setPlaceholder('Allow or disallow custom queues')
    .addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Allow Custom Queues')
            .setValue('true')
            .setDescription('Members can create queues for any game/mode'),
        new StringSelectMenuOptionBuilder()
            .setLabel('Disallow Custom Queues')
            .setValue('false')
            .setDescription('Members can only use game presets to create queues')
    );

const setupRow13 = new ActionRowBuilder()
    .addComponents(allowCustomQueuesSelect);

const backToStep4 = new ButtonBuilder()
    .setCustomId('back_to_step4')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

const completeSetupButton = new ButtonBuilder()
.setCustomId('finish_setup_2')
.setLabel('Finish Setup')
.setStyle(ButtonStyle.Success)

const setupRow14 = new ActionRowBuilder()
    .addComponents(backToStep4, completeSetupButton);
// Export components for reuse
export { setupRow8, setupRow9, setupRow10, setupRow11, setupRow12 };

// Export function to handle interactions
export function setupInteractionHandlers(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        // Handle the setup button
        if (interaction.customId === 'setup_bot') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ 
                    content: '**You are not admin for this server**\nPlease contact an admin to set up SquadForge', 
                    ephemeral: true 
                });
                return;
            }

            // Use the new setup logic with system type selection
            const setupEmbed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Setup - Step 1 (Steps may vary)')
                .setDescription('Choose how you want your queue system to operate!')
                .addFields(
                    {
                        name: '🏗️ Queue System Types',
                        value: 'Select the setup that best fits your server needs',
                        inline: false
                    },
                    {
                        name: '📋 Option Details',
                        value: 'Each option provides different levels of organization and channel usage',
                        inline: false
                    }
                )
                .setColor(0x0099ff);

            const queueSystemSelect = new StringSelectMenuBuilder()
                .setCustomId('queue_system_type')
                .setPlaceholder('Choose your queue system type')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Multi-Channel System')
                        .setValue('multi_channel')
                        .setDescription('Separate channel for each queue + creation channel')
                        .setEmoji('🏗️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Two-Channel System')
                        .setValue('two_channel')
                        .setDescription('One channel for queues + one for queue creation')
                        .setEmoji('📋'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Single-Channel System')
                        .setValue('single_channel')
                        .setDescription('All queues and creation in one channel')
                        .setEmoji('📝')
                );

            const systemTypeRow = new ActionRowBuilder().addComponents(queueSystemSelect);

            await interaction.reply({ 
                embeds: [setupEmbed],
                components: [systemTypeRow],
                ephemeral: true
            });
        }
    });
}

// Store temporary setup data per guild
const tempSetupData = new Map();

// Store active queues and their members
export const activeQueues = new Map(); // queueId -> { ownerId, channelId, members: Set, endTime, guildId, lastActivityCheck, activityTimer, maxEndTime, gameRoles: [], memberRoles: Map }
export const userQueues = new Map(); // userId -> queueId

// Function to show queue creation modal
async function showQueueCreationModal(interaction, gameName = null, gameMode = null, isPreset = false) {
    const modal = new ModalBuilder()
        .setCustomId('queue_creation_modal')
        .setTitle(isPreset ? `Create ${gameName} Queue` : 'Create Custom Queue');

    // Get guild settings to determine server limits
    const guildSettings = await getGuildSettings(interaction.guildId);
    const maxPlayers = guildSettings?.max_players || 50;
    const maxAvailability = guildSettings?.max_availability || 8;

    // Store preset data for later use
    if (isPreset) {
        if (!tempSetupData.has(interaction.guildId)) {
            tempSetupData.set(interaction.guildId, {});
        }
        tempSetupData.get(interaction.guildId).presetGame = gameName;
        tempSetupData.get(interaction.guildId).presetMode = gameMode;
    }

    let inputs = [];

    if (isPreset && gameMode === 'Other') {
        // For "Other" mode, ask for custom mode name, players needed and availability time
        const gameModeInput = new TextInputBuilder()
            .setCustomId('queue_game_mode')
            .setLabel('Game Mode')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Ranked, Competitive, Casual')
            .setRequired(true)
            .setMaxLength(20);

        const playersNeededInput = new TextInputBuilder()
            .setCustomId('queue_players_needed')
            .setLabel('Players Needed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`2-${maxPlayers}`)
            .setRequired(true)
            .setMaxLength(2);

        const availabilityTimeInput = new TextInputBuilder()
            .setCustomId('queue_availability_time')
            .setLabel('Availability Time (hours)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1-${maxAvailability}`)
            .setRequired(true)
            .setMaxLength(1);

        inputs = [gameModeInput, playersNeededInput, availabilityTimeInput];
    } else if (isPreset && (gameMode && gameMode !== null && gameMode !== 'Other')) {
        // For presets with a selected mode, only ask for players needed and availability time
        const playersNeededInput = new TextInputBuilder()
            .setCustomId('queue_players_needed')
            .setLabel('Players Needed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`2-${maxPlayers}`)
            .setRequired(true)
            .setMaxLength(2);

        const availabilityTimeInput = new TextInputBuilder()
            .setCustomId('queue_availability_time')
            .setLabel('Availability Time (hours)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1-${maxAvailability}`)
            .setRequired(true)
            .setMaxLength(1);

        inputs = [playersNeededInput, availabilityTimeInput];
    } else if (isPreset && (gameMode === null || gameMode === undefined)) {
        // For presets with no modes, ask for custom mode, players needed and availability time
        const gameModeInput = new TextInputBuilder()
            .setCustomId('queue_game_mode')
            .setLabel('Game Mode')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Ranked, Competitive, Casual')
            .setRequired(true)
            .setMaxLength(20);

        const playersNeededInput = new TextInputBuilder()
            .setCustomId('queue_players_needed')
            .setLabel('Players Needed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`2-${maxPlayers}`)
            .setRequired(true)
            .setMaxLength(2);

        const availabilityTimeInput = new TextInputBuilder()
            .setCustomId('queue_availability_time')
            .setLabel('Availability Time (hours)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1-${maxAvailability}`)
            .setRequired(true)
            .setMaxLength(1);

        inputs = [gameModeInput, playersNeededInput, availabilityTimeInput];
    } else {
        // For custom queues, ask for all fields
        const gameNameInput = new TextInputBuilder()
            .setCustomId('queue_game_name')
            .setLabel('Game Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Valorant, League of Legends, CS2')
            .setRequired(true)
            .setMaxLength(20)
            .setMinLength(2);

        const gameModeInput = new TextInputBuilder()
            .setCustomId('queue_game_mode')
            .setLabel('Game Mode (Optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Ranked, Competitive, Casual')
            .setRequired(false)
            .setMaxLength(20);

        const playersNeededInput = new TextInputBuilder()
            .setCustomId('queue_players_needed')
            .setLabel('Players Needed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`2-${maxPlayers}`)
            .setRequired(true)
            .setMaxLength(2);

        const availabilityTimeInput = new TextInputBuilder()
            .setCustomId('queue_availability_time')
            .setLabel('Availability Time (hours)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1-${maxAvailability}`)
            .setRequired(true)
            .setMaxLength(1);

        inputs = [gameNameInput, gameModeInput, playersNeededInput, availabilityTimeInput];
    }

    // Add inputs to action rows
    const rows = inputs.map(input => new ActionRowBuilder().addComponents(input));
    modal.addComponents(...rows);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
            content: 'Opening queue creation form...', 
            ephemeral: true 
        });
        return;
    } else {
        await interaction.showModal(modal);
    }
}

// Store role configuration data per guild
const roleConfigData = new Map();

// Store client reference for auto-delete function
let clientInstance = null;

// Initialize global queue searches if not exists
if (!global.activeQueueSearches) {
    global.activeQueueSearches = new Map();
}

// Function to check and notify users with matching queue searches
async function checkAndNotifyQueueSearches(client, queueData) {
    if (!global.activeQueueSearches || global.activeQueueSearches.size === 0) return;

    const currentTime = Date.now();
    const expiredSearches = [];

    for (const [userId, searchData] of global.activeQueueSearches.entries()) {
        // Remove expired searches
        if (currentTime > searchData.endTime) {
            expiredSearches.push(userId);
            continue;
        }

        // Check if the queue matches the search criteria
        if (searchData.guildId === queueData.guildId) {
            const gameNameMatch = queueData.gameName.toLowerCase().includes(searchData.gameName) || 
                                 searchData.gameName.includes(queueData.gameName.toLowerCase());
            
            let gameModeMatch = true;
            if (searchData.gameMode && queueData.gameMode) {
                gameModeMatch = queueData.gameMode.toLowerCase().includes(searchData.gameMode) || 
                              searchData.gameMode.includes(queueData.gameMode.toLowerCase());
            } else if (searchData.gameMode && !queueData.gameMode) {
                gameModeMatch = false;
            }

            if (gameNameMatch && gameModeMatch) {
                try {
                    const user = await client.users.fetch(userId);
                    const guild = client.guilds.cache.get(queueData.guildId);
                    
                    if (user && guild) {
                        const joinButton = new ButtonBuilder()
                            .setCustomId(`join_searched_queue_${queueData.id}_${userId}`)
                            .setLabel('Join Queue')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅');

                        const ignoreButton = new ButtonBuilder()
                            .setCustomId(`ignore_searched_queue_${userId}`)
                            .setLabel('Ignore')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌');

                        const buttonRow = new ActionRowBuilder().addComponents(joinButton, ignoreButton);

                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('🔍 Queue Found!')
                            .setDescription(`**A matching queue has been found in ${guild.name}!**`)
                            .addFields(
                                {
                                    name: '🎮 Game',
                                    value: `${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`,
                                    inline: false
                                },
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '👑 Queue Owner',
                                    value: `<@${queueData.ownerId}>`,
                                    inline: false
                                }
                            )
                            .setColor(0x00ff00)
                            .setFooter({ text: 'Would you like to join this queue?' })
                            .setTimestamp();

                        await user.send({
                            embeds: [notificationEmbed],
                            components: [buttonRow]
                        });

                        console.log(`Queue search notification sent for ${queueData.gameName}`);
                    }
                } catch (error) {
                    console.error('Error sending queue search notification:', error);
                }
            }
        }
    }

    // Clean up expired searches
    for (const userId of expiredSearches) {
        global.activeQueueSearches.delete(userId);
    }
}

// Store queue creation message IDs per guild
const queueCreationMessages = new Map(); // guildId -> messageId

// Function to cleanup stale queue creation message references
async function cleanupStaleQueueCreationMessage(client, guildId, channelId) {
    const existingMessageId = queueCreationMessages.get(guildId);
    if (!existingMessageId) return false;

    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            queueCreationMessages.delete(guildId);
            return false;
        }

        const existingMessage = await channel.messages.fetch(existingMessageId);
        
        // Check if it's still a valid queue creation message
        if (!existingMessage || 
            existingMessage.author.id !== client.user.id || 
            existingMessage.embeds.length === 0 || 
            existingMessage.embeds[0].title !== '🎮 Create a Gaming Queue') {
            
            queueCreationMessages.delete(guildId);
            return false;
        }

        return true; // Message is valid
    } catch (error) {
        // Message doesn't exist or can't be fetched
        queueCreationMessages.delete(guildId);
        return false;
    }
}

// Function to refresh queue creation message
async function refreshQueueCreationMessage(client, guildId, channelId) {
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.error(`Channel ${channelId} not found for guild ${guildId}`);
            return false;
        }

        const guildSettings = await getGuildSettings(guildId);
        if (!guildSettings) {
            console.error(`Guild settings not found for guild ${guildId}`);
            return false;
        }

        const gameData = gamePresets.get(guildId) || [];

        // Create queue creation embed with fresh random tip
        const randomTip = getRandomTip();
        const queueEmbed = new EmbedBuilder()
            .setTitle('🎮 Create a Gaming Queue')
            .setDescription('Find teammates and gaming buddies for your favorite games!')
            .addFields(
                {
                    name: '🎯 Quick Start',
                    value: gameData.length > 0 ? 'Use the buttons below to create a queue for popular games!' : 'Create a custom queue to get started!',
                    inline: false
                },
                {
                    name: '💫 Random Tip',
                    value: randomTip,
                    inline: false
                }
            )
            .setColor(0x0099ff)
            .setTimestamp();

        let components = [];

        // Add preset select menu if available (max 25 options)
        if (gameData.length > 0) {
            const presetOptions = gameData.slice(0, 25).map((game, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(game.name)
                    .setValue(`${index}`)
                    .setDescription(game.modes.length > 0 ? `${game.modes.length} modes available` : 'No specific modes')
                    .setEmoji('🎮')
            );

            const presetSelect = new StringSelectMenuBuilder()
                .setCustomId('queue_preset_select')
                .setPlaceholder('Choose a game preset')
                .addOptions(presetOptions);

            components.push(new ActionRowBuilder().addComponents(presetSelect));
        }

        // Add custom queue button if allowed
        if (guildSettings.allow_custom_queues !== false) {
            const customButton = new ButtonBuilder()
                .setCustomId('create_custom_queue')
                .setLabel('Create Custom Queue')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✨');

            components.push(new ActionRowBuilder().addComponents(customButton));
        }

        // Try to find and edit existing queue creation message
        const existingMessageId = queueCreationMessages.get(guildId);
        let message = null;
        let messageUpdated = false;
        
        if (existingMessageId) {
            try {
                const existingMessage = await channel.messages.fetch(existingMessageId);
                
                // Verify the message is actually ours - check author and look for queue creation indicators
                if (existingMessage.author.id === client.user.id) {
                    // Check if it's a queue creation message by looking at embed title or components
                    const hasQueueTitle = existingMessage.embeds.length > 0 && 
                        existingMessage.embeds[0].title && 
                        existingMessage.embeds[0].title.includes('Create a Gaming Queue');
                    
                    const hasQueueComponents = existingMessage.components.length > 0 && 
                        existingMessage.components.some(row => 
                            row.components.some(component => 
                                component.customId === 'queue_preset_select' || 
                                component.customId === 'create_custom_queue'
                            )
                        );
                    
                    if (hasQueueTitle || hasQueueComponents) {
                        message = await existingMessage.edit({
                            content: null, // Clear any content
                            embeds: [queueEmbed],
                            components: components
                        });
                        messageUpdated = true;
                        console.log(`Successfully refreshed existing queue creation message in guild ${guildId}`);
                    } else {
                        console.log(`Found message but it's not a queue creation message, creating new one`);
                        throw new Error('Message is not a queue creation message');
                    }
                } else {
                    console.log(`Found message but it's not from the bot, creating new one`);
                    throw new Error('Message is not from bot');
                }
            } catch (error) {
                console.log(`Could not update existing queue creation message: ${error.message}, creating new one`);
                
                // Clear the invalid message ID
                queueCreationMessages.delete(guildId);
                messageUpdated = false;
            }
        }
        
        // If we couldn't update an existing message, create a new one
        if (!messageUpdated) {
            message = await channel.send({
                embeds: [queueEmbed],
                components: components
            });
            queueCreationMessages.set(guildId, message.id);
            
            // Save to database
            try {
                const { saveQueueCreationMessage } = await import('./storage.js');
                await saveQueueCreationMessage(guildId, message.id, channelId);
                console.log(`Created new queue creation message in guild ${guildId}`);
            } catch (saveError) {
                console.error('Error saving queue creation message to database:', saveError);
            }
        }

        return true;

    } catch (error) {
        console.error('Error refreshing queue creation message:', error);
        return false;
    }
}

// Function to auto-delete queue
export async function autoDeleteQueue(queueId) {
    try {
        const queueData = activeQueues.get(queueId);
        if (!queueData) return;

        const guild = clientInstance.guilds.cache.get(queueData.guildId);
        if (!guild) return;

        // Delete the queue role if it exists
        if (queueData.queueRoleId) {
            try {
                const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                if (queueRole) {
                    await queueRole.delete('Queue expired or closed');
                }
            } catch (roleDeleteError) {
                console.error('Error deleting queue role:', roleDeleteError);
            }
        }

        const guildSettings = await getGuildSettings(queueData.guildId);
        if (guildSettings && guildSettings.system_type === 'multi_channel') {
            // Only delete channel for multi-channel system
            const channel = guild.channels.cache.get(queueData.channelId);
            if (channel) {
                await channel.delete('Queue expired');
            }
        } else if (guildSettings && (guildSettings.system_type === 'two_channel' || guildSettings.system_type === 'single_channel')) {
            // For two-channel and single-channel systems, find and delete the queue message
            const channel = guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    // Find the queue message and delete it
                    const messages = await channel.messages.fetch({ limit: 20 });
                    const queueMessage = messages.find(msg => 
                        msg.author.id === clientInstance.user.id &&
                        msg.embeds.length > 0 &&
                        msg.embeds[0].title &&
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        await queueMessage.delete();
                        console.log(`Queue message deleted`);
                    }
                } catch (messageDeleteError) {
                    console.error('Error deleting queue message:', messageDeleteError);
                }
            }
        }

        // Clean up queue data
        activeQueues.delete(queueId);
        queueData.members.forEach(memberId => {
            userQueues.delete(memberId);
        });

        // Delete from database
        try {
            const { deleteQueue } = await import('./storage.js');
            await deleteQueue(queueData.guildId, queueId);
        } catch (dbError) {
            console.error('Error deleting queue from database:', dbError);
        }

    } catch (error) {
        console.error('Error auto-deleting queue:', error);
    }
}

// Function to load game presets from database
async function loadGamePresetsFromDB() {
    try {
        // Get all guild settings to know which guilds exist
        const guilds = clientInstance.guilds.cache;

        for (const [guildId, guild] of guilds) {
            const presets = await getGamePresets(guildId);
            if (presets.length > 0) {
                gamePresets.set(guildId, presets);
                console.log(`Loaded ${presets.length} game presets for guild: ${guildId}`);
            }
        }
    } catch (error) {
        console.error('Error loading game presets from database:', error);
    }
}

// Function to load queue creation messages from database
async function loadQueueCreationMessagesFromDB() {
    try {
        const { loadQueueCreationMessages } = await import('./storage.js');
        const dbMessages = await loadQueueCreationMessages();
        
        // Replace the in-memory map with database data
        queueCreationMessages.clear();
        for (const [guildId, messageId] of dbMessages.entries()) {
            queueCreationMessages.set(guildId, messageId);
        }
        
        console.log(`Loaded ${queueCreationMessages.size} queue creation messages from database`);
    } catch (error) {
        console.error('Error loading queue creation messages from database:', error);
    }
}

// Function to refresh the game role management embed
async function refreshGameRoleManagementEmbed(interaction, queueId) {
    try {
        const queueData = activeQueues.get(queueId);
        if (!queueData) return;

        const userData = tempSetupData.get(interaction.user.id);
        if (!userData || !userData.sessionActive) return;

        const addRoleButton = new ButtonBuilder()
            .setCustomId('show_add_role_modal')
            .setLabel('Add Game Role')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕');

        const removeRoleButton = new ButtonBuilder()
            .setCustomId(`remove_game_role_${queueId}`)
            .setLabel('Remove Game Role')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(queueData.gameRoles.length === 0);

        const assignRoleButton = new ButtonBuilder()
            .setCustomId(`assign_game_role_${queueId}`)
            .setLabel('Assign Role to Member')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎯')
            .setDisabled(queueData.gameRoles.length === 0);

        const backButton = new ButtonBuilder()
            .setCustomId(`queue_owner_menu_${queueId}`)
            .setLabel('Back to Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️');

        const roleManagementRow1 = new ActionRowBuilder().addComponents(addRoleButton, removeRoleButton);
        const roleManagementRow2 = new ActionRowBuilder().addComponents(assignRoleButton, backButton);

        const globalRequirementText = queueData.globalRoleRequirement === null ? 
            'Not set (will be set when first role is added)' : 
            (queueData.globalRoleRequirement ? 'Required' : 'Optional');

        const roleListEmbed = new EmbedBuilder()
            .setTitle('🎭 Game Role Management')
            .setDescription(`Manage game roles for **${queueData.gameName}** queue`)
            .addFields(
                {
                    name: '🌐 Global Role Requirement',
                    value: `**${globalRequirementText}**\n${queueData.globalRoleRequirement !== null ? 'All roles in this queue follow this setting' : 'Will be set when you add the first role'}`,
                    inline: false
                },
                {
                    name: '📊 Current Game Roles',
                    value: queueData.gameRoles.length > 0 ? 
                        queueData.gameRoles.map((role, index) => 
                            `**${index + 1}.** ${role.name} (${role.currentPlayers.length}/${role.maxPlayers})`
                        ).join('\n') : 
                        'No game roles created yet',
                    inline: false
                },
                {
                    name: '📝 Available Actions',
                    value: '• Add new game role (max 5)\n• Remove existing role\n• Assign role to member',
                    inline: false
                }
            )
            .setColor(0x9932cc)
            .setFooter({ text: `Queue: ${queueData.gameName}` });

        // Find the original interaction message and update it
        const channel = interaction.channel;
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 20 });
            const targetMessage = messages.find(msg => 
                msg.author.id === clientInstance.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '🎭 Game Role Management'
            );

            if (targetMessage) {
                await targetMessage.edit({
                    embeds: [roleListEmbed],
                    components: [roleManagementRow1, roleManagementRow2]
                });
            }
        }
    } catch (error) {
        console.error('Error refreshing game role management embed:', error);
    }
}

export function setupselection(client) {
    // Store client reference
    clientInstance = client;

    // Load game presets from database on startup
    loadGamePresetsFromDB();

    // Load queue creation messages from database on startup - wait for completion
    loadQueueCreationMessagesFromDB().then(() => {
        console.log('Queue creation messages loaded successfully');
    }).catch(error => {
        console.error('Failed to load queue creation messages:', error);
    });

    // Set up periodic cleanup of stale queue creation messages (every 30 minutes)
    setInterval(async () => {
        for (const [guildId, messageId] of queueCreationMessages.entries()) {
            try {
                const guildSettings = await getGuildSettings(guildId);
                if (guildSettings) {
                    const channelId = guildSettings.queue_channel_id || guildSettings.creation_channel_id || guildSettings.single_channel_id;
                    if (channelId) {
                        await cleanupStaleQueueCreationMessage(client, guildId, channelId);
                    }
                }
            } catch (error) {
                console.warn(`Error during periodic cleanup for guild ${guildId}:`, error.message);
            }
        }
    }, 30 * 60 * 1000); // 30 minutes
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChannelSelectMenu() && !interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isRoleSelectMenu() && !interaction.isUserSelectMenu()) return;

        // Handle bot admin user select menus
        if (interaction.customId === 'bot_admin_add_user') {
            const targetUserId = interaction.values[0];
            const guildId = interaction.guildId;

            if (!global.botAdminsByGuildId) {
                global.botAdminsByGuildId = {};
            }
            if (!global.botAdminsByGuildId[guildId]) {
                global.botAdminsByGuildId[guildId] = new Set();
            }

            const adminSet = global.botAdminsByGuildId[guildId];
            const targetUser = await interaction.guild.members.fetch(targetUserId);
            
            if (adminSet.has(targetUserId)) {
                await interaction.update({
                    content: `❌ ${targetUser.user.tag} is already a bot admin.`,
                    components: []
                });
                return;
            }

            adminSet.add(targetUserId);
            await interaction.update({
                content: `✅ ${targetUser.user.tag} has been granted bot admin permissions.`,
                components: []
            });
            return;
        }

        if (interaction.customId === 'bot_admin_remove_user') {
            const targetUserId = interaction.values[0];
            const guildId = interaction.guildId;

            if (!global.botAdminsByGuildId) {
                global.botAdminsByGuildId = {};
            }
            if (!global.botAdminsByGuildId[guildId]) {
                global.botAdminsByGuildId[guildId] = new Set();
            }

            const adminSet = global.botAdminsByGuildId[guildId];
            const targetUser = await interaction.guild.members.fetch(targetUserId);
            
            if (!adminSet.has(targetUserId)) {
                await interaction.update({
                    content: `❌ ${targetUser.user.tag} is not a bot admin.`,
                    components: []
                });
                return;
            }

            adminSet.delete(targetUserId);
            await interaction.update({
                content: `✅ ${targetUser.user.tag} is no longer a bot admin.`,
                components: []
            });
            return;
        }

        // Handle settings page select menu navigation with error handling
        if (interaction.customId === 'settings_page_select') {
            try {
                const selectedPage = parseInt(interaction.values[0]);
                await showSettingsPage(interaction, selectedPage);
            } catch (error) {
                console.error('Error navigating settings page:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while navigating to that settings page. Please try again.',
                        ephemeral: true
                    });
                }
            }
            return;
        }

        const guildId = interaction.guildId;

        // Handle queue creation interactions
        if (interaction.customId === 'queue_preset_select') {
            const presetIndex = parseInt(interaction.values[0]);
            const gameData = gamePresets.get(guildId) || [];
            const selectedGame = gameData[presetIndex];

            if (!selectedGame) {
                await interaction.reply({
                    content: '❌ Game preset not found.',
                    ephemeral: true
                });
                return;
            }

            // Store preset data in temp setup data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).selectedPresetIndex = presetIndex;
            tempSetupData.get(guildId).selectedGameName = selectedGame.name;

            // Reset the select menu by updating the original message
            const guildSettings = await getGuildSettings(guildId);
            if (guildSettings) {
                // Create fresh queue creation embed and components
                const queueEmbed = new EmbedBuilder()
                    .setTitle('🎮 Create a Gaming Queue')
                    .setDescription('Find teammates and gaming buddies for your favorite games!')
                    .addFields(
                        {
                            name: '🎯 Quick Start',
                            value: gameData.length > 0 ? 'Use the buttons below to create a queue for popular games!' : 'Create a custom queue to get started!',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff)
                    .setTimestamp();

                let components = [];

                // Add preset select menu if available (max 25 options)
                if (gameData.length > 0) {
                    const presetOptions = gameData.slice(0, 25).map((game, index) => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(game.name)
                            .setValue(`${index}`)
                            .setDescription(game.modes.length > 0 ? `${game.modes.length} modes available` : 'No specific modes')
                            .setEmoji('🎮')
                    );

                    const presetSelect = new StringSelectMenuBuilder()
                        .setCustomId('queue_preset_select')
                        .setPlaceholder('Choose a game preset')
                        .addOptions(presetOptions);

                    components.push(new ActionRowBuilder().addComponents(presetSelect));
                }

                // Add custom queue button if allowed
                if (guildSettings.allow_custom_queues !== false) {
                    const customButton = new ButtonBuilder()
                        .setCustomId('create_custom_queue')
                        .setLabel('Create Custom Queue')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✨');

                    components.push(new ActionRowBuilder().addComponents(customButton));
                }

                // Update the original message to reset the select menu
                await interaction.update({
                    embeds: [queueEmbed],
                    components: components
                });
            }

            // If game has modes, show mode selection
            if (selectedGame.modes.length > 0) {
                const modeOptions = selectedGame.modes.map((mode, modeIndex) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(mode)
                        .setValue(`${modeIndex}`)
                        .setDescription(`Play ${selectedGame.name} - ${mode}`)
                );

                // Add "Other" option
                modeOptions.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Other')
                        .setValue('other')
                        .setDescription('Custom mode not listed above')
                );

                const modeSelect = new StringSelectMenuBuilder()
                    .setCustomId(`mode_select_${presetIndex}`)
                    .setPlaceholder('Select a game mode')
                    .addOptions(modeOptions);

                const modeRow = new ActionRowBuilder().addComponents(modeSelect);

                const modeEmbed = new EmbedBuilder()
                    .setTitle(`🎮 ${selectedGame.name} - Select Mode`)
                    .setDescription('Choose which game mode you want to play')
                    .setColor(0x0099ff);

                await interaction.followUp({
                    embeds: [modeEmbed],
                    components: [modeRow],
                    ephemeral: true
                });
            } else {
                // No modes, show a followUp message with a button to open the modal
                const createQueueButton = new ButtonBuilder()
                    .setCustomId(`create_queue_for_${presetIndex}`)
                    .setLabel(`Create ${selectedGame.name} Queue`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎮');

                const buttonRow = new ActionRowBuilder().addComponents(createQueueButton);

                const noModesEmbed = new EmbedBuilder()
                    .setTitle(`🎮 ${selectedGame.name}`)
                    .setDescription('This game has no specific modes. Click the button below to create a queue.')
                    .setColor(0x0099ff);

                await interaction.followUp({
                    embeds: [noModesEmbed],
                    components: [buttonRow],
                    ephemeral: true
                });
            }
        }

        if (interaction.customId?.startsWith('mode_select_')) {
            const presetIndex = parseInt(interaction.customId.split('_')[2]);
            const modeValue = interaction.values[0];
            const gameData = gamePresets.get(guildId) || [];
            const selectedGame = gameData[presetIndex];

            if (!selectedGame) {
                await interaction.reply({
                    content: '❌ Game preset not found.',
                    ephemeral: true
                });
                return;
            }

            if (modeValue === 'other') {
                // Show custom queue modal for "Other" mode
                await showQueueCreationModal(interaction, selectedGame.name, 'Other', true);
                return;
            }

            const modeIndex = parseInt(modeValue);
            const selectedMode = selectedGame.modes[modeIndex];

            if (!selectedMode) {
                await interaction.reply({
                    content: '❌ Game mode not found.',
                    ephemeral: true
                });
                return;
            }

            await showQueueCreationModal(interaction, selectedGame.name, selectedMode, true);
        }

        if (interaction.customId === 'create_custom_queue') {
            await showQueueCreationModal(interaction, null, null, false);
        }

        if (interaction.customId?.startsWith('create_queue_for_')) {
            const presetIndex = parseInt(interaction.customId.split('_')[3]);
            const gameData = gamePresets.get(guildId) || [];
            const selectedGame = gameData[presetIndex];

            if (!selectedGame) {
                await interaction.reply({
                    content: '❌ Game preset not found.',
                    ephemeral: true
                });
                return;
            }

            await showQueueCreationModal(interaction, selectedGame.name, null, true);
        }

        if (interaction.customId === 'more_presets') {
            const gameData = gamePresets.get(guildId) || [];

            const presetSelect = new StringSelectMenuBuilder()
                .setCustomId('preset_select')
                .setPlaceholder('Choose a game preset')
                .addOptions(
                    gameData.map((game, index) => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(game.name)
                            .setValue(`${index}`)
                            .setDescription(game.modes.length > 0 ? `${game.modes.length} modes available` : 'No specific modes')
                    )
                );

            const presetRow = new ActionRowBuilder().addComponents(presetSelect);

            const presetEmbed = new EmbedBuilder()
                .setTitle('🎮 Select Game Preset')
                .setDescription('Choose from all available game presets')
                .setColor(0x0099ff);

            await interaction.reply({
                embeds: [presetEmbed],
                components: [presetRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'preset_select') {
            const presetIndex = parseInt(interaction.values[0]);
            const gameData = gamePresets.get(guildId) || [];
            const selectedGame = gameData[presetIndex];

            if (selectedGame.modes.length > 0) {
                const modeOptions = selectedGame.modes.map((mode, modeIndex) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(mode)
                        .setValue(`${modeIndex}`)
                        .setDescription(`Play ${selectedGame.name} - ${mode}`)
                );

                // Add "Other" option
                modeOptions.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Other')
                        .setValue('other')
                        .setDescription('Custom mode not listed above')
                );

                const modeSelect = new StringSelectMenuBuilder()
                    .setCustomId(`mode_select_${presetIndex}`)
                    .setPlaceholder('Select a game mode')
                    .addOptions(modeOptions);

                const modeRow = new ActionRowBuilder().addComponents(modeSelect);

                const modeEmbed = new EmbedBuilder()
                    .setTitle(`🎮 ${selectedGame.name} - Select Mode`)
                    .setDescription('Choose which game mode you want to play')
                    .setColor(0x0099ff);

                await interaction.update({
                    embeds: [modeEmbed],
                    components: [modeRow]
                });
            } else {
                await showQueueCreationModal(interaction, selectedGame.name, null, true);
            }
        }

        if (interaction.customId === 'queue_creation_modal') {
            // Check if user is already in a queue
            if (userQueues.has(interaction.user.id)){
                await interaction.reply({
                    content: '❌ You are already in a queue! Please leave your current queue before creating a new one.',
                    ephemeral: true
                });
                return;
            }

            const guildSettings = await getGuildSettings(guildId);
            if (!guildSettings) {
                await interaction.reply({
                    content: '❌ Server not configured. Please run setup first.',
                    ephemeral: true
                });
                return;
            }

            // Get preset data if it exists
            const setupData = tempSetupData.get(guildId);
            const isPreset = setupData && setupData.presetGame;

            let gameName, gameMode;
            if (isPreset) {
                gameName = setupData.presetGame;
                if (setupData.presetMode === 'Other') {
                    // For "Other" mode, get the custom mode from the input
                    gameMode = interaction.fields.getTextInputValue('queue_game_mode')?.trim();
                } else if (setupData.presetMode && setupData.presetMode !== null) {
                    // For selected preset modes, use the preset mode
                    gameMode = setupData.presetMode;
                } else {
                    // For presets with no specific mode, get the custom mode from input
                    const gameModeField = interaction.fields.fields.get('queue_game_mode');
                    gameMode = gameModeField ? gameModeField.value?.trim() : null;
                }
                // Clean up temp data
                delete setupData.presetGame;
                delete setupData.presetMode;
            } else {
                gameName = interaction.fields.getTextInputValue('queue_game_name')?.trim();
                gameMode = interaction.fields.getTextInputValue('queue_game_mode')?.trim();
            }

            const playersNeededInput = interaction.fields.getTextInputValue('queue_players_needed')?.trim();
            const availabilityTimeInput = interaction.fields.getTextInputValue('queue_availability_time')?.trim();

            // Validate game name
            if (!gameName || gameName.length < 2) {
                await interaction.reply({
                    content: '❌ **Game name is required** and must be at least 2 characters long.',
                    ephemeral: true
                });
                return;
            }

            // Validate players needed input
            if (!playersNeededInput || isNaN(playersNeededInput)) {
                await interaction.reply({
                    content: '❌ **Players needed must be a valid number.**\nPlease enter a number between 2 and ' + guildSettings.max_players + '.',
                    ephemeral: true
                });
                return;
            }

            const playersNeeded = parseInt(playersNeededInput);
            if (playersNeeded < 2) {
                await interaction.reply({
                    content: '❌ **Players needed must be at least 2.**\nYou need at least one other player to form a queue.',
                    ephemeral: true
                });
                return;
            }

            if (playersNeeded > guildSettings.max_players) {
                await interaction.reply({
                    content: `❌ **Players needed exceeds server limit.**\nMaximum allowed: ${guildSettings.max_players} players.`,
                    ephemeral: true
                });
                return;
            }

            // Validate availability time input
            if (!availabilityTimeInput || isNaN(availabilityTimeInput)) {
                await interaction.reply({
                    content: '❌ **Availability time must be a valid number.**\nPlease enter a number between 1 and ' + guildSettings.max_availability + ' hours.',
                    ephemeral: true
                });
                return;
            }

            const availabilityTime = parseInt(availabilityTimeInput);
            if (availabilityTime < 1) {
                await interaction.reply({
                    content: '❌ **Availability time must be at least 1 hour.**\nPlease enter a time between 1 and ' + guildSettings.max_availability + ' hours.',
                    ephemeral: true
                });
                return;
            }

            if (availabilityTime > guildSettings.max_availability) {
                await interaction.reply({
                    content: `❌ **Availability time exceeds server limit.**\nMaximum allowed: ${guildSettings.max_availability} hours.`,
                    ephemeral: true
                });
                return;
            }

            // Check current queue count and limit behavior
            const currentQueueCount = Array.from(activeQueues.values()).filter(queue => queue.guildId === guildId).length;
            const maxQueues = guildSettings.max_queues || 5;
            const queueLimitBehavior = guildSettings.queue_limit_behavior || 'block';

            if (currentQueueCount >= maxQueues) {
                if (queueLimitBehavior === 'block') {
                    // Block mode: prevent new queue creation
                    await interaction.reply({
                        content: `❌ **Queue Limit Reached**\nThis server has reached its maximum of **${maxQueues} active queues**.\n\nPlease wait for an existing queue to end or close before creating a new one.\n\n*Current active queues: ${currentQueueCount}/${maxQueues}*`,
                        ephemeral: true
                    });
                    return;
                } else if (queueLimitBehavior === 'expire') {
                    // Expire mode: manage oldest queues
                    const serverQueues = Array.from(activeQueues.values())
                        .filter(queue => queue.guildId === guildId)
                        .sort((a, b) => a.createdAt - b.createdAt); // Oldest first

                    const queuesOverLimit = currentQueueCount - maxQueues + 1; // +1 for the new queue being created

                    if (queuesOverLimit >= 3) {
                        // Auto-delete oldest queues when 3+ over limit
                        const queuesToDelete = Math.min(queuesOverLimit, serverQueues.length);
                        for (let i = 0; i < queuesToDelete; i++) {
                            const oldQueue = serverQueues[i];
                            try {
                                await autoDeleteQueue(oldQueue.id);
                                console.log(`Auto-deleted queue ${oldQueue.id} due to limit exceeded`);
                            } catch (error) {
                                console.error(`Error auto-deleting queue ${oldQueue.id}:`, error);
                            }
                        }
                    } else if (queuesOverLimit > 0) {
                        // Add 5-minute expiration warnings to oldest queues
                        const queuesToWarn = Math.min(queuesOverLimit, serverQueues.length);
                        for (let i = 0; i < queuesToWarn; i++) {
                            const oldQueue = serverQueues[i];
                            try {
                                // Set a 5-minute expiration timer
                                const expirationTime = Date.now() + (5 * 60 * 1000); // 5 minutes
                                if (oldQueue.endTime > expirationTime) {
                                    oldQueue.endTime = expirationTime;
                                    
                                    // Send warning to queue channel
                                    const warningChannel = guild.channels.cache.get(oldQueue.channelId);
                                    if (warningChannel) {
                                        await warningChannel.send({
                                            content: `⚠️ **Queue Expiration Warning**\nThis queue will expire in **5 minutes** due to server queue limit being exceeded.\n\nNew queues are being created and older queues are being given priority expiration.`
                                        });
                                    }

                                    // Set new auto-deletion timer
                                    setTimeout(async () => {
                                        await autoDeleteQueue(oldQueue.id);
                                    }, 5 * 60 * 1000);
                                }
                            } catch (error) {
                                console.error(`Error setting expiration warning for queue ${oldQueue.id}:`, error);
                            }
                        }
                    }
                }
            }

            // Check if bot has necessary permissions
            const guild = interaction.guild;
            const botMember = guild.members.me;

            // Comprehensive permission check
            const missingPermissions = [];
            
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                missingPermissions.push('Manage Channels');
            }
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                missingPermissions.push('Manage Roles');
            }
            if (!botMember.permissions.has(PermissionFlagsBits.SendMessages)) {
                missingPermissions.push('Send Messages');
            }

            // Check role hierarchy
            const botRole = botMember.roles.highest;
            const everyoneRole = guild.roles.everyone;
            if (botRole.position <= everyoneRole.position) {
                missingPermissions.push('Proper Role Hierarchy (bot role must be above @everyone)');
            }

            if (missingPermissions.length > 0) {
                await interaction.reply({
                    content: `❌ **Bot Missing Critical Permissions**\n\n**Missing:**\n${missingPermissions.map(p => `• ${p}`).join('\n')}\n\n**Solutions:**\n1. Grant the missing permissions to the bot's role\n2. Move the bot's role higher in the server's role list\n3. **Temporary fix:** Grant Administrator permission\n\nContact a server admin to fix these permission issues.`,
                    ephemeral: true
                });
                return;
            }

            let queueChannel;

            if (guildSettings.system_type === 'multi_channel') {
                // Multi-channel system: create individual queue channels in category
                const category = guild.channels.cache.get(guildSettings.queue_category_id);
                if (!category) {
                    await interaction.reply({
                        content: '❌ **Queue category not found**\nThe configured queue category may have been deleted.\nPlease contact a server admin to run `/setup` again.',
                        ephemeral: true
                    });
                    return;
                }

                if (!category.permissionsFor(botMember).has(PermissionFlagsBits.ManageChannels)) {
                    await interaction.reply({
                        content: '❌ **Bot Missing Category Permissions**\nI need the "Manage Channels" permission in the queue category.\nPlease contact a server admin to grant this permission.',
                        ephemeral: true
                    });
                    return;
                }

                try {
                    // Create queue channel
                    queueChannel = await guild.channels.create({
                        name: `${gameName.toLowerCase().replace(/\s+/g, '-')}-queue`,
                        type: ChannelType.GuildText,
                        parent: category,
                        topic: `Queue for ${gameName}${gameMode ? ` - ${gameMode}` : ''} | Created by ${interaction.user.username}`,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.SendMessages],
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                            }
                        ]
                    });
                } catch (createError) {
                    console.error('Error creating queue channel:', createError);
                    throw createError; // Re-throw to be handled by outer catch block
                }
            } else if (guildSettings.system_type === 'two_channel' || guildSettings.system_type === 'single_channel') {
                // Two-channel or single-channel system: use existing display/single channel
                const channelId = guildSettings.display_channel_id || guildSettings.single_channel_id;
                queueChannel = guild.channels.cache.get(channelId);

                if (!queueChannel) {
                    await interaction.reply({
                        content: '❌ **Queue display channel not found**\nThe configured queue display channel may have been deleted.\nPlease contact a server admin to run `/setup` again.',
                        ephemeral: true
                    });
                    return;
                }

                if (!queueChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                    await interaction.reply({
                        content: '❌ **Bot Missing Channel Permissions**\nI need the "Send Messages" permission in the queue display channel.\nPlease contact a server admin to grant this permission.',
                        ephemeral: true
                    });
                    return;
                }
            } else {
                await interaction.reply({
                    content: '❌ **Invalid system configuration**\nPlease contact a server admin to run `/setup` again.',
                    ephemeral: true
                });
                return;
            }

            try {

                // Fetch role ping configuration for this game preset
                let rolePingMention = '';
                if (isPreset) {
                    const rolePingConfigs = await getRolePingConfigurations(guildId);
                    // Find matching config for gameName and gameMode (or all modes)
                    let config = rolePingConfigs.find(cfg => cfg.game_name === gameName && (cfg.game_mode === gameMode || !cfg.game_mode || cfg.game_mode === null));
                    if (!config && gameMode) {
                        // Fallback: try to find config for gameName and no mode
                        config = rolePingConfigs.find(cfg => cfg.game_name === gameName && (!cfg.game_mode || cfg.game_mode === null));
                    }
                    if (config) {
                        rolePingMention = `<@&${config.role_id}> `;
                    }
                }

                // Create unique queue ID
                const queueId = `${guildId}_${Date.now()}_${interaction.user.id}`;
                const endTime = Date.now() + (availabilityTime * 60 * 60 * 1000);
                const maxEndTime = Date.now() + (4 * 60 * 60 * 1000); // Max queue time: 4 hours
                const initialActivityCheck = Date.now() + (45 * 60 * 1000); // 45-minute initial timer

                // Create temporary Discord role for this queue
                let queueRole = null;
                try {
                    queueRole = await guild.roles.create({
                        name: `${gameName} Queue`,
                        color: 'Random',
                        mentionable: true,
                        reason: `Temporary role for ${gameName} queue`
                    });
                } catch (roleError) {
                    console.error('Error creating queue role:', roleError);
                    // Continue without role if creation fails
                }

                // Store queue data
                const queueData = {
                    id: queueId,
                    ownerId: interaction.user.id,
                    channelId: queueChannel.id,
                    members: new Set([interaction.user.id]),
                    endTime: endTime,
                    guildId: guildId,
                    gameName: gameName,
                    gameMode: gameMode,
                    playersNeeded: playersNeeded,
                    availabilityTime: availabilityTime,
                    lastActivityCheck: null, // Initialize last activity check
                    activityTimer: null, // Initialize activity timer
                    maxEndTime: maxEndTime, // Max queue time
                    gameRoles: [], // Array of game roles: { name, maxPlayers, currentPlayers: [] }
                    memberRoles: new Map(), // Map of userId -> roleIndex
                    queueRoleId: queueRole?.id || null, // Store the Discord role ID
                    globalRoleRequirement: null, // null = not set, true = required, false = optional
                    description: null, // Custom queue description
                    createdAt: new Date()
                };

                activeQueues.set(queueId, queueData);
                userQueues.set(interaction.user.id, queueId);

                // Save queue to database
                try {
                    const { saveQueue } = await import('./storage.js');
                    await saveQueue(guildId, {
                        id: queueId,
                        gameName: gameName,
                        gameMode: gameMode,
                        playersNeeded: playersNeeded,
                        maxPlayers: playersNeeded,
                        ownerId: interaction.user.id,
                        players: new Set([interaction.user.id]),
                        availability: [availabilityTime],
                        availabilityTime: availabilityTime,
                        createdAt: new Date()
                    });
                    console.log(`Queue saved to database for ${gameName}`);
                } catch (saveError) {
                    console.error('Error saving queue to database:', saveError);
                    // Continue execution even if database save fails
                }

                // Assign queue role to the creator
                if (queueRole) {
                    try {
                        const member = await guild.members.fetch(interaction.user.id);
                        await member.roles.add(queueRole);
                    } catch (roleAssignError) {
                        console.error('Error assigning queue role to creator:', roleAssignError);
                    }
                }

                // Schedule auto-deletion
                setTimeout(async () => {
                    await autoDeleteQueue(queueId);
                }, availabilityTime * 60 * 60 * 1000);

                const finalLookingForPlayers = (`${playersNeeded - 1}`)

                const queueEmbed = new EmbedBuilder()
                .setAuthor({
                  name: ` ${interaction.member?.displayName ?? interaction.user.username}👑`,
                  iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                    })
                    .setTitle(`🎮 ${gameName}${gameMode ? ` - ${gameMode}` : ''}`)
                    .setDescription(`Looking for ${finalLookingForPlayers} players`)
                    .addFields(
                        {
                            name: '👥 Players',
                            value: `1/${playersNeeded}`,
                            inline: true
                        },
                        {
                            name: '⏰ Available Until',
                            value: `<t:${Math.floor(endTime / 1000)}:R>`,
                            inline: true
                        },
                        {
                            name: '📝 Queue Members',
                            value: `<@${interaction.user.id}>`,
                            inline: false
                        },
                        {
                            name: '💫 Gaming Tip',
                            value: getRandomTip(),
                            inline: false
                        }
                    )
                    .setColor(0x00ff00)
                    .setTimestamp();

                // Add description field if it exists
                if (queueData.description) {
                    queueEmbed.addFields({
                        name: '📋 Description',
                        value: queueData.description,
                        inline: false
                    });
                }
                    const LeaveEmoji = {
                      id: '1403530880731058206',
                      name: 'Leave_Button'
                    };

                    const JoinEmoji = {
                        id: '1403530973081239595',
                        name: 'Join_Button'
                    };

                    const OwnerEmoji = {
                        id: '1403527087695859772',
                        name: 'Queue_Menu'
                    };
                
                const joinButton = new ButtonBuilder()
                    .setCustomId(`join_queue_${queueId}`)
                    .setLabel('Join Queue')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(JoinEmoji);

                const leaveButton = new ButtonBuilder()
                    .setCustomId(`leave_queue_${queueId}`)
                    .setLabel('Leave Queue')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(LeaveEmoji);

                const ownerMenuButton = new ButtonBuilder()
                    .setCustomId(`queue_owner_menu_${queueId}`)
                    .setLabel('Queue Owner Menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(OwnerEmoji);

                const queueRow = new ActionRowBuilder().addComponents(joinButton, leaveButton, ownerMenuButton);

                await interaction.reply({
                    content: `🎮 **Queue Created!** <@${interaction.user.id}> is looking for teammates!\n📍 Queue Channel: <#${queueChannel.id}>`,
                    ephemeral: true
                });

                // Send initial message to queue channel
                try {
                    await queueChannel.send({
                        content: rolePingMention || undefined,
                        embeds: [queueEmbed],
                        components: [queueRow]
                    });
                } catch (sendError) {
                    console.error('Error sending message to queue channel:', sendError);

                    // If we can't send to the queue channel, clean up and inform user
                    try {
                        if (guildSettings.system_type === 'multi_channel') {
                            await queueChannel.delete();
                        }
                    } catch (deleteError) {
                        console.error('Error deleting queue channel after send failure:', deleteError);
                    }

                    // Clean up queue data
                    activeQueues.delete(queueId);
                    userQueues.delete(interaction.user.id);

                    // Clean up queue role if it was created
                    if (queueRole) {
                        try {
                            await queueRole.delete();
                        } catch (roleDeleteError) {
                            console.error('Error deleting queue role after failure:', roleDeleteError);
                        }
                    }

                    // Check if we can still respond to the interaction
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.followUp({
                            content: '❌ **Failed to initialize queue**\nI couldn\'t send messages to the queue channel.\nPlease contact a server admin to check bot permissions.',
                            ephemeral: true
                        });
                    }
                    return;
                }

                // Check for matching queue searches and notify users
                await checkAndNotifyQueueSearches(interaction.client, queueData);

                // Refresh the queue creation message with new tip for all system types
                let refreshChannelId = null;
                if (guildSettings.system_type === 'single_channel') {
                    refreshChannelId = guildSettings.single_channel_id;
                } else if (guildSettings.system_type === 'two_channel') {
                    refreshChannelId = guildSettings.creation_channel_id;
                } else if (guildSettings.system_type === 'multi_channel') {
                    refreshChannelId = guildSettings.queue_channel_id;
                }

                if (refreshChannelId) {
                    await refreshQueueCreationMessage(interaction.client, guildId, refreshChannelId);
                }

            } catch (error) {
                console.error('Error creating queue:', error);

                // Clean up any created resources
                if (queueRole) {
                    try {
                        await queueRole.delete();
                    } catch (roleDeleteError) {
                        console.error('Error cleaning up queue role after error:', roleDeleteError);
                    }
                }

                // Provide specific error messages based on the error type
                let errorMessage = '❌ **Failed to create queue**\n';

                if (error.code === 50013) {
                    errorMessage += 'I don\'t have permission to create channels in this category.\nPlease contact a server admin to grant the "Manage Channels" permission.';
                } else if (error.code === 50001) {
                    errorMessage += 'I don\'t have access to the queue category.\nPlease contact a server admin to check bot permissions.';
                } else if (error.code === 30013) {
                    errorMessage += 'The server has reached the maximum number of channels.\nPlease contact a server admin to delete some unused channels.';
                } else if (error.code === 10003) {
                    errorMessage += 'The configured channel no longer exists.\nPlease contact a server admin to run `/setup` again.';
                } else if (error.message?.includes('category')) {
                    errorMessage += 'There was an issue with the queue category.\nPlease contact a server admin to run `/setup` again.';
                } else {
                    errorMessage += 'An unexpected error occurred. Please try again later.\nIf the problem persists, contact a server admin.';
                }

                // Only reply if we haven't already replied
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: errorMessage,
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error('Error sending error message to user:', replyError);
                    }
                }
            }
        }

        if (interaction.customId === 'queue_system_type') {
            const systemType = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).systemType = systemType;

            // Show different setup steps based on system type
            if (systemType === 'multi_channel') {
                // Current setup - channel for creation + category for individual queues
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Multi-Channel System)')
                    .setDescription('Configure channels for your multi-channel queue system!')
                    .addFields(
                        {
                            name: '📢 Queue Creation Channel',
                            value: 'Select a channel where members can create game queues',
                            inline: false
                        },
                        { 
                            name: '📂 Queue Category',
                            value: 'Select a category where individual queue channels will be created',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [setupRow1, setupRow2, setupRow3]
                });
            } else if (systemType === 'two_channel') {
                // Two channel setup - one for creation, one for queues
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Two-Channel System)')
                    .setDescription('Configure channels for your two-channel queue system!')
                    .addFields(
                        {
                            name: '📢 Queue Creation Channel',
                            value: 'Select a channel where members can create game queues',
                            inline: false
                        },
                        { 
                            name: '🎮 Queue Display Channel',
                            value: 'Select a channel where active queues will be displayed',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                const creationChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_creation_channel')
                    .setPlaceholder('Select queue creation channel')
                    .addChannelTypes(ChannelType.GuildText);

                const displayChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_display_channel')
                    .setPlaceholder('Select queue display channel')
                    .addChannelTypes(ChannelType.GuildText);

                const creationRow = new ActionRowBuilder().addComponents(creationChannelSelect);
                const displayRow = new ActionRowBuilder().addComponents(displayChannelSelect);
                const continueRow = new ActionRowBuilder().addComponents(continueSetup1);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [creationRow, displayRow, continueRow]
                });
            } else if (systemType === 'single_channel') {
                // Single channel setup - everything in one channel
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Single-Channel System)')
                    .setDescription('Configure your all-in-one queue channel!')
                    .addFields(
                        {
                            name: '🎮 Queue Channel',
                            value: 'Select a channel where queues will be created and displayed',
                            inline: false
                        },
                        {
                            name: '📝 How it works',
                            value: 'Members create queues and all active queues are displayed in this channel. The creation message refreshes to stay at the bottom.',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                const singleChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_single_channel')
                    .setPlaceholder('Select your queue channel')
                    .addChannelTypes(ChannelType.GuildText);

                const singleChannelRow = new ActionRowBuilder().addComponents(singleChannelSelect);
                const continueRow = new ActionRowBuilder().addComponents(continueSetup1);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [singleChannelRow, continueRow]
                });
            }
        }

        if (interaction.customId === 'selected_creation_channel') {
            const selectedChannel = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).creationChannelId = selectedChannel;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'selected_display_channel') {
            const selectedChannel = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).displayChannelId = selectedChannel;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'selected_single_channel') {
            const selectedChannel = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).singleChannelId = selectedChannel;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'selected_queue_channel') {
            const selectedChannel = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).queueChannelId = selectedChannel;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'selected_category') {
            const selectedCategory = interaction.values[0];

            // Store in temporary data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).queueCategoryId = selectedCategory;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'continue_setup1') {
            const setupData = tempSetupData.get(guildId);

            if (!setupData || !setupData.systemType) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the setup process.',
                    ephemeral: true
                });
                return;
            }

            // Validate based on system type
            if (setupData.systemType === 'multi_channel') {
                if (!setupData.queueChannelId || !setupData.queueCategoryId) {
                    await interaction.reply({
                        content: '❌ Please select both a queue channel and category before continuing.',
                        ephemeral: true
                    });
                    return;
                }
            } else if (setupData.systemType === 'two_channel') {
                if (!setupData.creationChannelId || !setupData.displayChannelId) {
                    await interaction.reply({
                        content: '❌ Please select both creation and display channels before continuing.',
                        ephemeral: true
                    });
                    return;
                }
            } else if (setupData.systemType === 'single_channel') {
                if (!setupData.singleChannelId) {
                    await interaction.reply({
                        content: '❌ Please select a queue channel before continuing.',
                        ephemeral: true
                    });
                    return;
                }
            }

            // Show step 3 of setup (configuration)
            const step3Embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Setup - Step 3 (Steps may vary)')
                .setDescription('Configure your server limits and settings')
                .addFields(
                    {
                        name: '🔢 Max Queues',
                        value: 'How many queues can be active at once? (1-25)',
                        inline: false
                    },
                    {
                        name: '👥 Max Players',
                        value: 'Maximum players per queue? (2-50)',
                        inline: false
                    },
                    {
                        name: '⏰ Availability Time',
                        value: 'Maximum hours users can set availability? (1-8)',
                        inline: false
                    }
                )
                .setColor(0x0099ff);

            await interaction.update({
                embeds: [step3Embed],
                components: [setupRow4, setupRow5, setupRow6, setupRow7]
            });
        }

        if (interaction.customId === 'max_queues') {
            const maxQueues = interaction.values[0];

            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).maxQueues = parseInt(maxQueues);

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'max_players') {
            const maxPlayers = interaction.values[0];

            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).maxPlayers = parseInt(maxPlayers);

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'max_availability') {
            const maxAvailability = interaction.values[0];

            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).maxAvailability = parseInt(maxAvailability);

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'back_to_step1' && !interaction.replied && !interaction.deferred) {
            // Go back to step 1 of setup (system type selection)
            const setupEmbed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Setup - Step 1 (Steps may vary)')
                .setDescription('Choose how you want your queue system to operate!')
                .addFields(
                    {
                        name: '🏗️ Queue System Types',
                        value: 'Select the setup that best fits your server needs',
                        inline: false
                    },
                    {
                        name: '📋 Option Details',
                        value: 'Each option provides different levels of organization and channel usage',
                        inline: false
                    }
                )
                .setColor(0x0099ff);

            const queueSystemSelect = new StringSelectMenuBuilder()
                .setCustomId('queue_system_type')
                .setPlaceholder('Choose your queue system type')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Multi-Channel System')
                        .setValue('multi_channel')
                        .setDescription('Separate channel for each queue + creation channel')
                        .setEmoji('🏗️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Two-Channel System')
                        .setValue('two_channel')
                        .setDescription('One channel for queues + one for queue creation')
                        .setEmoji('📋'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Single-Channel System')
                        .setValue('single_channel')
                        .setDescription('All queues and creation in one channel')
                        .setEmoji('📝')
                );

            const systemTypeRow = new ActionRowBuilder().addComponents(queueSystemSelect);

            await interaction.update({ 
                embeds: [setupEmbed],
                components: [systemTypeRow]
            });
        }

        if (interaction.customId === 'back_to_step2' && !interaction.replied && !interaction.deferred) {
            const setupData = tempSetupData.get(guildId);

            if (!setupData || !setupData.systemType) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the setup process.',
                    ephemeral: true
                });
                return;
            }

            // Go back to step 2 based on system type
            if (setupData.systemType === 'multi_channel') {
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Multi-Channel System)')
                    .setDescription('Configure channels for your multi-channel queue system!')
                    .addFields(
                        {
                            name: '📢 Queue Creation Channel',
                            value: 'Select a channel where members can create game queues',
                            inline: false
                        },
                        { 
                            name: '📂 Queue Category',
                            value: 'Select a category where individual queue channels will be created',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [setupRow1, setupRow2, setupRow3]
                });
            } else if (setupData.systemType === 'two_channel') {
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Two-Channel System)')
                    .setDescription('Configure channels for your two-channel queue system!')
                    .addFields(
                        {
                            name: '📢 Queue Creation Channel',
                            value: 'Select a channel where members can create game queues',
                            inline: false
                        },
                        { 
                            name: '🎮 Queue Display Channel',
                            value: 'Select a channel where active queues will be displayed',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                const creationChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_creation_channel')
                    .setPlaceholder('Select queue creation channel')
                    .addChannelTypes(ChannelType.GuildText);

                const displayChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_display_channel')
                    .setPlaceholder('Select queue display channel')
                    .addChannelTypes(ChannelType.GuildText);

                const creationRow = new ActionRowBuilder().addComponents(creationChannelSelect);
                const displayRow = new ActionRowBuilder().addComponents(displayChannelSelect);
                const continueRow = new ActionRowBuilder().addComponents(continueSetup1);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [creationRow, displayRow, continueRow]
                });
            } else if (setupData.systemType === 'single_channel') {
                const step2Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 2 (Single-Channel System)')
                    .setDescription('Configure your all-in-one queue channel!')
                    .addFields(
                        {
                            name: '🎮 Queue Channel',
                            value: 'Select a channel where queues will be created and displayed',
                            inline: false
                        },
                        {
                            name: '📝 How it works',
                            value: 'Members create queues and all active queues are displayed in this channel. The creation message refreshes to stay at the bottom.',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                const singleChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('selected_single_channel')
                    .setPlaceholder('Select your queue channel')
                    .addChannelTypes(ChannelType.GuildText);

                const singleChannelRow = new ActionRowBuilder().addComponents(singleChannelSelect);
                const continueRow = new ActionRowBuilder().addComponents(continueSetup1);

                await interaction.update({
                    embeds: [step2Embed],
                    components: [singleChannelRow, continueRow]
                });
            }
        }

        if (interaction.customId === 'finish_setup') {
            const setupData = tempSetupData.get(guildId);

            if (!setupData || !setupData.systemType || !setupData.maxQueues || !setupData.maxPlayers || !setupData.maxAvailability) {
                await interaction.reply({
                    content: '❌ Please complete all configuration options before finishing setup.',
                    ephemeral: true
                });
                return;
            }

            // Validate channels based on system type
            if (setupData.systemType === 'multi_channel' && (!setupData.queueChannelId || !setupData.queueCategoryId)) {
                await interaction.reply({
                    content: '❌ Please select both queue channel and category for multi-channel system.',
                    ephemeral: true
                });
                return;
            } else if (setupData.systemType === 'two_channel' && (!setupData.creationChannelId || !setupData.displayChannelId)) {
                await interaction.reply({
                    content: '❌ Please select both creation and display channels for two-channel system.',
                    ephemeral: true
                });
                return;
            } else if (setupData.systemType === 'single_channel' && !setupData.singleChannelId) {
                await interaction.reply({
                    content: '❌ Please select a queue channel for single-channel system.',
                    ephemeral: true
                });
                return;
            }

            // Move to step 3 (Game Presets)
            const step3Embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Setup - Step 3 (Steps may vary - Optional)')
                .setDescription('Add game presets to make it easier for users to create queues!')
                .addFields(
                    {
                        name: '🎮 Add Games',
                        value: 'Click "Add Game" to create a new game preset with optional modes (Max: 8 presets)',
                        inline: false
                    },
                    {
                        name: '📝 Instructions',
                        value: '• Enter a game name (required)\n• Add up to 8 game modes (optional)\n• Leave modes blank if not needed\n• Maximum 8 game presets total',
                        inline: false
                    },
                    {
                        name: '⏭️ Skip This Step',
                        value: 'You can skip this step if you don\'t want to add game presets now',
                        inline: false
                    }
                )
                .setColor(0x0099ff);

            await interaction.update({
                embeds: [step3Embed],
                components: [setupRow8, setupRow9]
            });
        }

        if (interaction.customId === 'skip_presets') {
            // Skip presets - finish setup immediately
            const setupData = tempSetupData.get(guildId);

            // Save to database
            const channelData = {
                queueChannelId: setupData.queueChannelId,
                queueCategoryId: setupData.queueCategoryId,
                creationChannelId: setupData.creationChannelId,
                displayChannelId: setupData.displayChannelId,
                singleChannelId: setupData.singleChannelId
            };

            const success = await saveGuildSettings(
                guildId, 
                setupData.systemType,
                channelData,
                setupData.maxQueues,
                setupData.maxPlayers,
                setupData.maxAvailability
            );

            if (success) {
                // Clear temporary data
                tempSetupData.delete(guildId);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Setup Complete!')
                    .setDescription('SquadForge has been successfully configured for your server!')
                    .setColor(0x00ff00)
                    .setTimestamp();

                // Add fields based on system type
                if (setupData.systemType === 'multi_channel') {
                    successEmbed.addFields(
                        {
                            name: '📢 Queue Channel',
                            value: `<#${setupData.queueChannelId}>`,
                            inline: true
                        },
                        {
                            name: '📂 Queue Category',
                            value: `<#${setupData.queueCategoryId}>`,
                            inline: true
                        }
                    );
                } else if (setupData.systemType === 'two_channel') {
                    successEmbed.addFields(
                        {
                            name: '📢 Creation Channel',
                            value: `<#${setupData.creationChannelId}>`,
                            inline: true
                        },
                        {
                            name: '🎮 Display Channel',
                            value: `<#${setupData.displayChannelId}>`,
                            inline: true
                        }
                    );
                } else if (setupData.systemType === 'single_channel') {
                    successEmbed.addFields(
                        {
                            name: '🎮 Queue Channel',
                            value: `<#${setupData.singleChannelId}>`,
                            inline: true
                        }
                    );
                }

                successEmbed.addFields(
                    {
                        name: '🔢 Max Queues',
                        value: `${setupData.maxQueues}`,
                        inline: true
                    },
                    {
                        name: '👥 Max Players',
                        value: `${setupData.maxPlayers}`,
                        inline: true
                    },
                    {
                        name: '⏰ Max Availability',
                        value: `${setupData.maxAvailability} hours`,
                        inline: true
                    }
                );

                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });

                // Send queue creation message to the configured queue channel
                const channelId = setupData.queueChannelId || setupData.creationChannelId || setupData.singleChannelId;
                if (channelId) {
                    await refreshQueueCreationMessage(interaction.client, guildId, channelId);
                }
            } else {
                await interaction.reply({
                    content: '❌ Failed to save configuration. Please try again.',
                    ephemeral: true
                });
            }
        }

        if (interaction.customId === 'allow_custom_queues') {
            const allowCustomQueues = interaction.values[0] === 'true';

            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).allowCustomQueues = allowCustomQueues;

            await interaction.deferUpdate();
        }

        if (interaction.customId === 'back_to_step4') {
            // Go back to step 4 (Custom Queue Permissions)
            const step4Embed = new EmbedBuilder()
                .setTitle('⚙️ SquadForge Setup - Step 4 (Final Step)')
                .setDescription('Configure whether members can create custom queues or only use game presets.')
                .addFields(
                    {
                        name: '🎮 Custom Queues',
                        value: 'Allow members to create queues for any game/mode, or restrict to game presets only.',
                        inline: false
                    }
                )
                .setColor(0x0099ff);

            await interaction.update({
                embeds: [step4Embed],
                components: [setupRow13, setupRow14]
            });
        }

        if (interaction.customId === 'finish_setup_2') {
            // Final setup completion with custom queue settings
            const setupData = tempSetupData.get(guildId);

            if (!setupData) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the setup process.',
                    ephemeral: true
                });
                return;
            }

            // Use the allowCustomQueues setting or default to true
            const allowCustomQueues = setupData.allowCustomQueues !== undefined ? setupData.allowCustomQueues : true;

            // Save to database with custom queue setting
            const channelData = {
                queueChannelId: setupData.queueChannelId,
                queueCategoryId: setupData.queueCategoryId,
                creationChannelId: setupData.creationChannelId,
                displayChannelId: setupData.displayChannelId,
                singleChannelId: setupData.singleChannelId
            };

            const success = await saveGuildSettings(
                guildId, 
                setupData.systemType,
                channelData,
                setupData.maxQueues,
                setupData.maxPlayers,
                setupData.maxAvailability,
                allowCustomQueues
            );

            if (success) {
                // Clear temporary data
                tempSetupData.delete(guildId);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Setup Complete!')
                    .setDescription('SquadForge has been successfully configured for your server!')
                    .setColor(0x00ff00)
                    .setTimestamp();

                // Add fields based on system type
                if (setupData.systemType === 'multi_channel') {
                    successEmbed.addFields(
                        {
                            name: '📢 Queue Channel',
                            value: `<#${setupData.queueChannelId}>`,
                            inline: true
                        },
                        {
                            name: '📂 Queue Category',
                            value: `<#${setupData.queueCategoryId}>`,
                            inline: true
                        }
                    );
                } else if (setupData.systemType === 'two_channel') {
                    successEmbed.addFields(
                        {
                            name: '📢 Creation Channel',
                            value: `<#${setupData.creationChannelId}>`,
                            inline: true
                        },
                        {
                            name: '🎮 Display Channel',
                            value: `<#${setupData.displayChannelId}>`,
                            inline: true
                        }
                    );
                } else if (setupData.systemType === 'single_channel') {
                    successEmbed.addFields(
                        {
                            name: '🎮 Queue Channel',
                            value: `<#${setupData.singleChannelId}>`,
                            inline: true
                        }
                    );
                }

                successEmbed.addFields(
                    {
                        name: '🔢 Max Queues',
                        value: `${setupData.maxQueues}`,
                        inline: true
                    },
                    {
                        name: '👥 Max Players',
                        value: `${setupData.maxPlayers}`,
                        inline: true
                    },
                    {
                        name: '⏰ Max Availability',
                        value: `${setupData.maxAvailability} hours`,
                        inline: true
                    },
                    {
                        name: '🎮 Custom Queues',
                        value: allowCustomQueues ? 'Allowed' : 'Restricted to presets',
                        inline: true
                    }
                );

                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });

                // Send queue creation message to the configured queue channel
                const channelId = setupData.queueChannelId || setupData.creationChannelId || setupData.singleChannelId;
                if (channelId) {
                    await refreshQueueCreationMessage(interaction.client, guildId, channelId);
                }
            } else {
                await interaction.reply({
                    content: '❌ Failed to save configuration. Please try again.',
                    ephemeral: true
                });
            }
        }

        if (interaction.customId === 'continue_to_step4') {
            // Check if any game presets have been added
            if (gamePresets.get(guildId) && gamePresets.get(guildId).length > 0) {
                // Move to step 4 (Custom Queue Permissions)
                const step4Embed = new EmbedBuilder()
                    .setTitle('⚙️ SquadForge Setup - Step 4 (Final Step)')
                    .setDescription('Configure whether members can create custom queues or only use game presets.')
                    .addFields(
                        {
                            name: '🎮 Custom Queues',
                            value: 'Allow members to create queues for any game/mode, or restrict to game presets only.',
                            inline: false
                        }
                    )
                    .setColor(0x0099ff);

                await interaction.update({
                    embeds: [step4Embed],
                    components: [setupRow13, setupRow14]
                });
            } else {
                // No presets, finish setup immediately
                const setupData = tempSetupData.get(guildId);

                if (!setupData) {
                    await interaction.reply({
                        content: '❌ Setup data not found. Please restart the setup process.',
                        ephemeral: true
                    });
                    return;
                }

                // Save basic configuration to database
                const channelData = {
                    queueChannelId: setupData.queueChannelId,
                    queueCategoryId: setupData.queueCategoryId,
                    creationChannelId: setupData.creationChannelId,
                    displayChannelId: setupData.displayChannelId,
                    singleChannelId: setupData.singleChannelId
                };

                const success = await saveGuildSettings(
                    guildId, 
                    setupData.systemType,
                    channelData,
                    setupData.maxQueues,
                    setupData.maxPlayers,
                    setupData.maxAvailability
                );

                if (success) {
                    // Clear temporary data
                    tempSetupData.delete(guildId);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('🎉 Setup Complete!')
                        .setDescription('SquadForge has been successfully configured for your server!')
                        .setColor(0x00ff00)
                        .setTimestamp();

                    await interaction.update({
                        embeds: [successEmbed],
                        components: []
                    });

                    // Send queue creation message to the configured queue channel
                    const channelId = setupData.queueChannelId || setupData.creationChannelId || setupData.singleChannelId;
                    if (channelId) {
                        await refreshQueueCreationMessage(interaction.client, guildId, channelId);
                    }
                } else {
                    await interaction.reply({
                        content: '❌ Failed to save configuration. Please try again.',
                        ephemeral: true
                    });
                }
            }
        }

        // Add more interaction handlers that were missing
        if (interaction.customId === 'add_game_preset') {
            // Check if the user is an admin
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({
                    content: '❌ Only administrators can add game presets.',
                    ephemeral: true
                });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('add_game_preset_modal')
                .setTitle('Add Game Preset');

            const gameNameInput = new TextInputBuilder()
                .setCustomId('game_name')
                .setLabel('Game Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Valorant, League of Legends, CS2')
                .setRequired(true)
                .setMaxLength(50);

            const gameModesInput = new TextInputBuilder()
                .setCustomId('game_modes')
                .setLabel('Game Modes (Optional, max 8)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter each mode on a new line:\nRanked\nUnranked\nCompetitive\nCasual')
                .setRequired(false)
                .setMaxLength(500);

            const gameNameRow = new ActionRowBuilder().addComponents(gameNameInput);
            const gameModesRow = new ActionRowBuilder().addComponents(gameModesInput);

            modal.addComponents(gameNameRow, gameModesRow);
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'add_game_preset_modal') {
            const gameName = interaction.fields.getTextInputValue('game_name').trim();
            const gameModesInput = interaction.fields.getTextInputValue('game_modes').trim();

            if (!gameName) {
                await interaction.reply({
                    content: '❌ Game name is required.',
                    ephemeral: true
                });
                return;
            }

            const gameModes = gameModesInput ? gameModesInput.split('\n').map(mode => mode.trim()).filter(mode => mode.length > 0).slice(0, 8) : [];

            // Initialize game presets if not exists
            if (!gamePresets.has(guildId)) {
                gamePresets.set(guildId, []);
            }

            const currentPresets = gamePresets.get(guildId);

            // Check if we can add more presets
            if (currentPresets.length >= 8) {
                await interaction.reply({
                    content: '❌ Maximum of 8 game presets allowed.',
                    ephemeral: true
                });
                return;
            }

            // Add the new preset
            currentPresets.push({
                name: gameName,
                modes: gameModes
            });

            await interaction.reply({
                content: `✅ Added game preset: **${gameName}**${gameModes.length > 0 ? ` with ${gameModes.length} mode(s)` : ''}`,
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_add_preset') {
            const modal = new ModalBuilder()
                .setCustomId('settings_add_preset_modal')
                .setTitle('Add Game Preset');

            const gameNameInput = new TextInputBuilder()
                .setCustomId('settings_game_name')
                .setLabel('Game Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Valorant, League of Legends, CS2')
                .setRequired(true)
                .setMaxLength(50);

            const gameModesInput = new TextInputBuilder()
                .setCustomId('settings_game_modes')
                .setLabel('Game Modes (Optional, max 8)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter each mode on a new line:\nRanked\nUnranked\nCompetitive\nCasual')
                .setRequired(false)
                .setMaxLength(500);

            const gameNameRow = new ActionRowBuilder().addComponents(gameNameInput);
            const gameModesRow = new ActionRowBuilder().addComponents(gameModesInput);

            modal.addComponents(gameNameRow, gameModesRow);
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'settings_add_preset_modal') {
            const gameName = interaction.fields.getTextInputValue('settings_game_name').trim();
            const gameModesInput = interaction.fields.getTextInputValue('settings_game_modes').trim();

            if (!gameName) {
                await interaction.reply({
                    content: '❌ Game name is required.',
                    ephemeral: true
                });
                return;
            }

            const gameModes = gameModesInput ? gameModesInput.split('\n').map(mode => mode.trim()).filter(mode => mode.length > 0).slice(0, 8) : [];

            // Get current temp settings
            const sessionData = settingsData.get(guildId);
            if (!sessionData) {
                await interaction.reply({
                    content: '❌ Settings session not found. Please restart settings.',
                    ephemeral: true
                });
                return;
            }

            // Check if we can add more presets
            if (sessionData.tempGamePresets.length >= 8) {
                await interaction.reply({
                    content: '❌ Maximum of 8 game presets allowed.',
                    ephemeral: true
                });
                return;
            }

            // Add the new preset to temp settings
            sessionData.tempGamePresets.push({
                name: gameName,
                modes: gameModes
            });

            await interaction.reply({
                content: `✅ Added game preset: **${gameName}**${gameModes.length > 0 ? ` with ${gameModes.length} mode(s)` : ''}`,
                ephemeral: true
            });

            // Refresh the settings page
            await showSettingsPage(interaction, sessionData.currentPage);
        }

        if (interaction.customId === 'settings_add_mode') {
            const sessionData = settingsData.get(guildId);
            if (!sessionData || sessionData.tempGamePresets.length === 0) {
                await interaction.reply({
                    content: '❌ No game presets found. Add a game preset first.',
                    ephemeral: true
                });
                return;
            }

            // Create game select menu for adding modes
            const gameOptions = sessionData.tempGamePresets.map((game, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(game.name)
                    .setValue(`${index}`)
                    .setDescription(`Currently has ${game.modes.length} mode(s)`)
            );

            const gameSelect = new StringSelectMenuBuilder()
                .setCustomId('settings_select_game_for_mode')
                .setPlaceholder('Select a game to add mode to')
                .addOptions(gameOptions);

            const selectRow = new ActionRowBuilder().addComponents(gameSelect);

            await interaction.reply({
                content: 'Select which game you want to add a mode to:',
                components: [selectRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_select_game_for_mode') {
            const gameIndex = parseInt(interaction.values[0]);
            const sessionData = settingsData.get(guildId);

            if (!sessionData || !sessionData.tempGamePresets[gameIndex]) {
                await interaction.reply({
                    content: '❌ Game not found.',
                    ephemeral: true
                });
                return;
            }

            const selectedGame = sessionData.tempGamePresets[gameIndex];

            if (selectedGame.modes.length >= 8) {
                await interaction.reply({
                    content: '❌ Maximum of 8 modes per game allowed.',
                    ephemeral: true
                });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`settings_add_mode_modal_${gameIndex}`)
                .setTitle(`Add Mode to ${selectedGame.name}`);

            const modeInput = new TextInputBuilder()
                .setCustomId('mode_name')
                .setLabel('Mode Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Ranked, Competitive, Casual')
                .setRequired(true)
                .setMaxLength(25);

            const modeRow = new ActionRowBuilder().addComponents(modeInput);
            modal.addComponents(modeRow);

            await interaction.showModal(modal);
        }

        if (interaction.customId?.startsWith('settings_add_mode_modal_')) {
            const gameIndex = parseInt(interaction.customId.split('_')[4]);
            const modeName = interaction.fields.getTextInputValue('mode_name').trim();

            if (!modeName) {
                await interaction.reply({
                    content: '❌ Mode name is required.',
                    ephemeral: true
                });
                return;
            }

            const sessionData = settingsData.get(guildId);
            if (!sessionData || !sessionData.tempGamePresets[gameIndex]) {
                await interaction.reply({
                    content: '❌ Game not found.',
                    ephemeral: true
                });
                return;
            }

            const selectedGame = sessionData.tempGamePresets[gameIndex];

            // Check if mode already exists
            if (selectedGame.modes.includes(modeName)) {
                await interaction.reply({
                    content: '❌ This mode already exists for this game.',
                    ephemeral: true
                });
                return;
            }

            // Add the mode
            selectedGame.modes.push(modeName);

            await interaction.reply({
                content: `✅ Added mode **${modeName}** to **${selectedGame.name}**`,
                ephemeral: true
            });

            // Refresh the settings page
            await showSettingsPage(interaction, sessionData.currentPage);
        }

        if (interaction.customId === 'settings_add_role_ping') {
            const sessionData = settingsData.get(guildId);
            if (!sessionData || sessionData.tempGamePresets.length === 0) {
                await interaction.reply({
                    content: '❌ No game presets found. Add game presets first to configure role pings.',
                    ephemeral: true
                });
                return;
            }

            const selectRoleMenu = new RoleSelectMenuBuilder()
                .setCustomId('settings_select_role_for_ping')
                .setPlaceholder('Select a role to configure pings for')
                .setMaxValues(1);

            const roleRow = new ActionRowBuilder().addComponents(selectRoleMenu);

            await interaction.reply({
                content: 'Select which role should be pinged:',
                components: [roleRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_select_role_for_ping') {
            const roleId = interaction.values[0];
            const sessionData = settingsData.get(guildId);

            if (!sessionData || sessionData.tempGamePresets.length === 0) {
                await interaction.reply({
                    content: '❌ No game presets found.',
                    ephemeral: true
                });
                return;
            }

            // Store the selected role in session data
            sessionData.selectedRoleForPing = roleId;

            const gameSelect = createSimpleGameSelectMenuForRoles(guildId);
            const gameRow = new ActionRowBuilder().addComponents(gameSelect);

            await interaction.update({
                content: `Selected role: <@&${roleId}>\nNow select which game to configure role pings for:`,
                components: [gameRow]
            });
        }

        if (interaction.customId === 'selected_game_for_role_simple') {
            const selectedValue = interaction.values[0];
            const sessionData = settingsData.get(guildId);

            if (!sessionData || !sessionData.selectedRoleForPing) {
                await interaction.reply({
                    content: '❌ Role selection not found. Please restart the process.',
                    ephemeral: true
                });
                return;
            }

            if (selectedValue === 'no_games') {
                await interaction.update({
                    content: '❌ No games available. Please add game presets first.',
                    components: []
                });
                return;
            }

            const gameIndex = parseInt(selectedValue.split('_')[1]);
            const game = sessionData.tempGamePresets[gameIndex];

            if (!game) {
                await interaction.update({
                    content: '❌ Game not found.',
                    components: []
                });
                return;
            }

            // Store the selected game
            sessionData.selectedGameForPing = game;

            // Show modal to configure which modes
            const modal = new ModalBuilder()
                .setCustomId('configure_role_ping_modal')
                .setTitle(`Configure Role Pings for ${game.name}`);

            const modesInput = new TextInputBuilder()
                .setCustomId('selected_modes')
                .setLabel('Game Modes (leave empty for all modes)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(game.modes.length > 0 ? 
                    `Available modes:\n${game.modes.join('\n')}\n\nEnter specific modes (one per line) or leave empty for all modes` : 
                    'This game has no specific modes - leave empty for all modes'
                )
                .setRequired(false)
                .setMaxLength(500);

            const modesRow = new ActionRowBuilder().addComponents(modesInput);
            modal.addComponents(modesRow);

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'configure_role_ping_modal') {
            const sessionData = settingsData.get(guildId);

            if (!sessionData || !sessionData.selectedRoleForPing || !sessionData.selectedGameForPing) {
                await interaction.reply({
                    content: '❌ Configuration data not found. Please restart the process.',
                    ephemeral: true
                });
                return;
            }

            const roleId = sessionData.selectedRoleForPing;
            const game = sessionData.selectedGameForPing;
            const modesInput = interaction.fields.getTextInputValue('selected_modes').trim();

            let selectedModes = [];
            if (modesInput) {
                selectedModes = modesInput.split('\n').map(mode => mode.trim()).filter(mode => mode.length > 0);
                // Validate that all entered modes exist for this game
                const invalidModes = selectedModes.filter(mode => !game.modes.includes(mode));
                if (invalidModes.length > 0) {
                    await interaction.reply({
                        content: `❌ Invalid modes: ${invalidModes.join(', ')}\n\nAvailable modes for ${game.name}: ${game.modes.join(', ') || 'No specific modes'}`,
                        ephemeral: true
                    });
                    return;
                }
            }

            // Save configurations
            let successCount = 0;
            const results = [];

            if (selectedModes.length === 0) {
                // Save for all modes
                const success = await saveRolePingConfiguration(guildId, roleId, game.name, null);
                if (success) {
                    successCount++;
                    results.push(`${game.name} (All modes)`);
                }
            } else {
                // Save for specific modes
                for (const mode of selectedModes) {
                    const success = await saveRolePingConfiguration(guildId, roleId, game.name, mode);
                    if (success) {
                        successCount++;
                        results.push(`${game.name} - ${mode}`);
                    }
                }
            }

            // Clean up session data
            delete sessionData.selectedRoleForPing;
            delete sessionData.selectedGameForPing;

            if (successCount > 0) {
                await interaction.reply({
                    content: `✅ **Role ping configuration saved!**\n<@&${roleId}> will be pinged for:\n• ${results.join('\n• ')}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to save role ping configuration.',
                    ephemeral: true
                });
            }
        }

        if (interaction.customId === 'settings_remove_role_ping') {
            // Get current role ping configurations
            const rolePingConfigs = await getRolePingConfigurations(guildId);

            if (rolePingConfigs.length === 0) {
                await interaction.reply({
                    content: '❌ No role ping configurations found to remove.',
                    ephemeral: true
                });
                return;
            }

            // Create options for removal
            const removeOptions = rolePingConfigs.map((config, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${config.game_name}${config.game_mode ? ` - ${config.game_mode}` : ' (All modes)'}`)
                    .setValue(`${index}`)
                    .setDescription(`Role: ${interaction.guild.roles.cache.get(config.role_id)?.name || 'Unknown Role'}`)
            ).slice(0, 25); // Discord limit

            const removeSelect = new StringSelectMenuBuilder()
                .setCustomId('settings_confirm_remove_role_ping')
                .setPlaceholder('Select configurations to remove')
                .addOptions(removeOptions)
                .setMaxValues(Math.min(removeOptions.length, 25));

            const removeRow = new ActionRowBuilder().addComponents(removeSelect);

            await interaction.reply({
                content: 'Select which role ping configurations to remove:',
                components: [removeRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_confirm_remove_role_ping') {
            const selectedIndices = interaction.values.map(v => parseInt(v));
            const rolePingConfigs = await getRolePingConfigurations(guildId);

            let successCount = 0;
            const removedConfigs = [];

            for (const index of selectedIndices) {
                const config = rolePingConfigs[index];
                if (config) {
                    const success = await removeRolePingConfiguration(guildId, config.role_id, config.game_name, config.game_mode);
                    if (success) {
                        successCount++;
                        removedConfigs.push(`${config.game_name}${config.game_mode ? ` - ${config.game_mode}` : ' (All modes)'}`);
                    }
                }
            }

            if (successCount > 0) {
                await interaction.update({
                    content: `✅ **Removed ${successCount} role ping configuration(s):**\n• ${removedConfigs.join('\n• ')}`,
                    components: []
                });
            } else {
                await interaction.update({
                    content: '❌ Failed to remove role ping configurations.',
                    components: []
                });
            }
        }

        if (interaction.customId === 'settings_save') {
            try {
                const sessionData = settingsData.get(guildId);
                if (!sessionData) {
                    await interaction.reply({
                        content: '❌ Settings session not found.',
                        ephemeral: true
                    });
                    return;
                }

                // Save game presets to database
                const success = await saveGamePresets(guildId, sessionData.tempGamePresets);
                if (success) {
                    // Update in-memory storage
                    gamePresets.set(guildId, sessionData.tempGamePresets);

                    // Refresh queue creation message
                    const guildSettings = await getGuildSettings(guildId);
                    if (guildSettings) {
                        const channelId = guildSettings.queue_channel_id || guildSettings.creation_channel_id || guildSettings.single_channel_id;
                        if (channelId) {
                            await refreshQueueCreationMessage(interaction.client, guildId, channelId);
                        }
                    }

                    // Clear session data
                    settingsData.delete(guildId);

                    await interaction.reply({
                        content: '✅ Settings saved successfully! Queue creation message has been refreshed.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Failed to save settings. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while saving settings. Please try again.',
                        ephemeral: true
                    });
                }
            }
        }

        if (interaction.customId === 'settings_cancel') {
            try {
                // Clear session data
                settingsData.delete(guildId);

                await interaction.reply({
                    content: '❌ **Settings cancelled.**\n\nNo changes have been made to your server configuration.',
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error cancelling settings:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Settings cancelled.',
                        ephemeral: true
                    });
                }
            }
        }

        if (interaction.customId === 'settings_remove_preset') {
            const sessionData = settingsData.get(guildId);
            if (!sessionData || sessionData.tempGamePresets.length === 0) {
                await interaction.reply({
                    content: '❌ No game presets found to remove.',
                    ephemeral: true
                });
                return;
            }

            // Create select menu for removing presets
            const presetOptions = sessionData.tempGamePresets.map((game, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(game.name)
                    .setValue(`${index}`)
                    .setDescription(`${game.modes.length} mode(s)`)
            );

            const presetSelect = new StringSelectMenuBuilder()
                .setCustomId('settings_confirm_remove_preset')
                .setPlaceholder('Select presets to remove')
                .addOptions(presetOptions)
                .setMaxValues(Math.min(presetOptions.length, 25));

            const selectRow = new ActionRowBuilder().addComponents(presetSelect);

            await interaction.reply({
                content: 'Select which game presets to remove:',
                components: [selectRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_confirm_remove_preset') {
            const selectedIndices = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a); // Sort descending to remove from end first
            const sessionData = settingsData.get(guildId);

            if (!sessionData) {
                await interaction.reply({
                    content: '❌ Settings session not found.',
                    ephemeral: true
                });
                return;
            }

            const removedPresets = [];
            selectedIndices.forEach(index => {
                if (sessionData.tempGamePresets[index]) {
                    removedPresets.push(sessionData.tempGamePresets[index].name);
                    sessionData.tempGamePresets.splice(index, 1);
                }
            });

            await interaction.update({
                content: `✅ **Removed ${removedPresets.length} game preset(s):**\n• ${removedPresets.join('\n• ')}`,
                components: []
            });

            // Refresh the settings page
            await showSettingsPage(interaction, sessionData.currentPage);
        }

        if (interaction.customId === 'settings_remove_mode') {
            const sessionData = settingsData.get(guildId);
            if (!sessionData || sessionData.tempGamePresets.length === 0) {
                await interaction.reply({
                    content: '❌ No game presets found.',
                    ephemeral: true
                });
                return;
            }

            // Find games with modes
            const gamesWithModes = sessionData.tempGamePresets.filter(game => game.modes.length > 0);

            if (gamesWithModes.length === 0) {
                await interaction.reply({
                    content: '❌ No games with modes found to remove from.',
                    ephemeral: true
                });
                return;
            }

            // Create game select menu for removing modes
            const gameOptions = gamesWithModes.map((game, index) => {
                const originalIndex = sessionData.tempGamePresets.indexOf(game);
                return new StringSelectMenuOptionBuilder()
                    .setLabel(game.name)
                    .setValue(`${originalIndex}`)
                    .setDescription(`Has ${game.modes.length} mode(s)`);
            });

            const gameSelect = new StringSelectMenuBuilder()
                .setCustomId('settings_select_game_for_mode_removal')
                .setPlaceholder('Select a game to remove modes from')
                .addOptions(gameOptions);

            const selectRow = new ActionRowBuilder().addComponents(gameSelect);

            await interaction.reply({
                content: 'Select which game you want to remove modes from:',
                components: [selectRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'settings_select_game_for_mode_removal') {
            const gameIndex = parseInt(interaction.values[0]);
            const sessionData = settingsData.get(guildId);

            if (!sessionData || !sessionData.tempGamePresets[gameIndex]) {
                await interaction.reply({
                    content: '❌ Game not found.',
                    ephemeral: true
                });
                return;
            }

            const selectedGame = sessionData.tempGamePresets[gameIndex];

            if (selectedGame.modes.length === 0) {
                await interaction.reply({
                    content: '❌ This game has no modes to remove.',
                    ephemeral: true
                });
                return;
            }

            // Create mode select menu
            const modeOptions = selectedGame.modes.map((mode, modeIndex) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(mode)
                    .setValue(`${modeIndex}`)
                    .setDescription(`Remove from ${selectedGame.name}`)
            );

            const modeSelect = new StringSelectMenuBuilder()
                .setCustomId(`settings_confirm_remove_mode_${gameIndex}`)
                .setPlaceholder('Select modes to remove')
                .addOptions(modeOptions)
                .setMaxValues(Math.min(modeOptions.length, 25));

            const selectRow = new ActionRowBuilder().addComponents(modeSelect);

            await interaction.update({
                content: `Select which modes to remove from **${selectedGame.name}**:`,
                components: [selectRow]
            });
        }

        if (interaction.customId?.startsWith('settings_confirm_remove_mode_')) {
            const gameIndex = parseInt(interaction.customId.split('_')[4]);
            const selectedModeIndices = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a); // Sort descending
            const sessionData = settingsData.get(guildId);

            if (!sessionData || !sessionData.tempGamePresets[gameIndex]) {
                await interaction.reply({
                    content: '❌ Game not found.',
                    ephemeral: true
                });
                return;
            }

            const selectedGame = sessionData.tempGamePresets[gameIndex];
            const removedModes = [];

            selectedModeIndices.forEach(modeIndex => {
                if (selectedGame.modes[modeIndex]) {
                    removedModes.push(selectedGame.modes[modeIndex]);
                    selectedGame.modes.splice(modeIndex, 1);
                }
            });

            await interaction.update({
                content: `✅ **Removed ${removedModes.length} mode(s) from ${selectedGame.name}:**\n• ${removedModes.join('\n• ')}`,
                components: []
            });

            // Refresh the settings page
            await showSettingsPage(interaction, sessionData.currentPage);
        }

        if (interaction.customId === 'settings_remove_role_ping_modal') {
            // Handle remove role ping modal submission
            await interaction.reply({
                content: '✅ Role ping configuration removed.',
                ephemeral: true
            });
        }

        // Handle queue limit behavior button
        if (interaction.customId === 'settings_queue_limit_behavior') {
            const guildSettings = await getGuildSettings(guildId);
            const currentBehavior = guildSettings?.queue_limit_behavior || 'block';

            const blockButton = new ButtonBuilder()
                .setCustomId('set_queue_behavior_block')
                .setLabel('Block Mode')
                .setStyle(currentBehavior === 'block' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🚫');

            const expireButton = new ButtonBuilder()
                .setCustomId('set_queue_behavior_expire')
                .setLabel('Expire Mode')
                .setStyle(currentBehavior === 'expire' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('⏰');

            const behaviorRow = new ActionRowBuilder().addComponents(blockButton, expireButton);

            const behaviorEmbed = new EmbedBuilder()
                .setTitle('🚦 Queue Limit Behavior Configuration')
                .setDescription('Choose how your server handles queue creation when the limit is reached.')
                .addFields(
                    {
                        name: '🚫 Block Mode (Current Default)',
                        value: '• **Simple:** Prevents new queue creation when limit is reached\n• **User-friendly:** Shows clear error message explaining the limit\n• **Predictable:** Users know exactly when they can\'t create queues',
                        inline: false
                    },
                    {
                        name: '⏰ Expire Mode (Advanced)',
                        value: '• **Flexible:** Allows new queues even when at limit\n• **Smart Management:** Adds 5-minute expiration warnings to oldest queues\n• **Auto-cleanup:** Instantly deletes oldest queues when 3+ over limit',
                        inline: false
                    },
                    {
                        name: '📊 Current Setting',
                        value: `**${currentBehavior === 'expire' ? 'Expire Mode' : 'Block Mode'}** - ${currentBehavior === 'expire' ? 'Advanced queue management with automatic expiration' : 'Simple queue blocking when limit reached'}`,
                        inline: false
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Select your preferred queue limit behavior' });

            await interaction.reply({
                embeds: [behaviorEmbed],
                components: [behaviorRow],
                ephemeral: true
            });
        }

        // Handle queue behavior setting buttons
        if (interaction.customId === 'set_queue_behavior_block' || interaction.customId === 'set_queue_behavior_expire') {
            const newBehavior = interaction.customId === 'set_queue_behavior_expire' ? 'expire' : 'block';
            const guildSettings = await getGuildSettings(guildId);

            if (!guildSettings) {
                await interaction.reply({
                    content: '❌ Guild settings not found. Please run setup first.',
                    ephemeral: true
                });
                return;
            }

            // Update the setting in the database
            const channelData = {
                queueChannelId: guildSettings.queue_channel_id,
                queueCategoryId: guildSettings.queue_category_id,
                creationChannelId: guildSettings.creation_channel_id,
                displayChannelId: guildSettings.display_channel_id,
                singleChannelId: guildSettings.single_channel_id
            };

            const success = await saveGuildSettings(
                guildId,
                guildSettings.system_type,
                channelData,
                guildSettings.max_queues,
                guildSettings.max_players,
                guildSettings.max_availability,
                guildSettings.allow_custom_queues,
                newBehavior
            );

            if (success) {
                const behaviorName = newBehavior === 'expire' ? 'Expire Mode' : 'Block Mode';
                const description = newBehavior === 'expire' ? 
                    'Your server now allows queue creation even when at limit, with automatic expiration management.' :
                    'Your server now blocks new queue creation when the limit is reached.';

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Queue Limit Behavior Updated!')
                    .setDescription(`**${behaviorName}** has been enabled for your server.`)
                    .addFields({
                        name: '📝 What this means',
                        value: description,
                        inline: false
                    })
                    .setColor(0x00ff00)
                    .setTimestamp();

                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update queue limit behavior. Please try again.',
                    ephemeral: true
                });
            }
        }

        // Handle leaderboard setup interactions
        if (interaction.customId === 'leaderboard_setup_start') {
            const guildId = interaction.guildId;
            const guild = interaction.guild;

            // Check if server is a community server
            if (!guild.features.includes('COMMUNITY')) {
                const noCommunityEmbed = new EmbedBuilder()
                    .setTitle('❌ Community Server Required')
                    .setDescription('**Your server must be a Community Server to join the leaderboard.**')
                    .addFields(
                        {
                            name: '📋 How to enable Community Server',
                            value: '1. Go to Server Settings\n2. Click "Enable Community"\n3. Follow the setup steps\n4. Return here and try again',
                            inline: false
                        },
                        {
                            name: '🔒 Why is this required?',
                            value: 'Community servers have moderation tools and public features that help maintain a safe environment for all users.',
                            inline: false
                        }
                    )
                    .setColor(0xff0000)
                    .setFooter({ text: 'Enable Community Server and try again' });

                await interaction.update({
                    embeds: [noCommunityEmbed],
                    components: []
                });
                return;
            }

            // Show content rating selection
            const contentEmbed = new EmbedBuilder()
                .setTitle('🔞 Content Rating Setup')
                .setDescription('**Please select what type of content your server allows.**\n\nThis helps users find servers that match their preferences.')
                .addFields(
                    {
                        name: '📝 Content Categories',
                        value: 'Select all that apply to your server\'s content and community guidelines.',
                        inline: false
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'Be honest about your server\'s content' });

            const nsfwButton = new ButtonBuilder()
                .setCustomId('content_nsfw_toggle')
                .setLabel('NSFW Content')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔞');

            const swearingButton = new ButtonBuilder()
                .setCustomId('content_swearing_toggle')
                .setLabel('Swearing Allowed')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🤬');

            const matureButton = new ButtonBuilder()
                .setCustomId('content_mature_toggle')
                .setLabel('Mature Themes')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚠️');

            const adultButton = new ButtonBuilder()
                .setCustomId('content_adult_toggle')
                .setLabel('Adult Discussions')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔞');

            const cleanOnlyButton = new ButtonBuilder()
                .setCustomId('content_clean_only_toggle')
                .setLabel('Clean Content Only')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✨');

            const continueButton = new ButtonBuilder()
                .setCustomId('content_setup_continue')
                .setLabel('Continue')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️');

            const contentRow1 = new ActionRowBuilder().addComponents(nsfwButton, swearingButton);
            const contentRow2 = new ActionRowBuilder().addComponents(matureButton, adultButton);
            const contentRow3 = new ActionRowBuilder().addComponents(cleanOnlyButton, continueButton);

            // Initialize content settings in temp data
            if (!tempSetupData.has(guildId)) {
                tempSetupData.set(guildId, {});
            }
            tempSetupData.get(guildId).contentSettings = {
                'NSFW Content': false,
                'Swearing Allowed': false,
                'Mature Themes': false,
                'Adult Discussions': false,
                'Clean Content Only': false
            };

            await interaction.update({
                embeds: [contentEmbed],
                components: [contentRow1, contentRow2, contentRow3]
            });
        }

        // Handle content toggle buttons
        if (interaction.customId?.startsWith('content_') && interaction.customId?.includes('_toggle')) {
            const guildId = interaction.guildId;
            const setupData = tempSetupData.get(guildId);

            if (!setupData || !setupData.contentSettings) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the process.',
                    ephemeral: true
                });
                return;
            }

            let settingKey;
            switch (interaction.customId) {
                case 'content_nsfw_toggle':
                    settingKey = 'NSFW Content';
                    break;
                case 'content_swearing_toggle':
                    settingKey = 'Swearing Allowed';
                    break;
                case 'content_mature_toggle':
                    settingKey = 'Mature Themes';
                    break;
                case 'content_adult_toggle':
                    settingKey = 'Adult Discussions';
                    break;
                case 'content_clean_only_toggle':
                    settingKey = 'Clean Content Only';
                    break;
            }

            // Handle Clean Content Only logic
            if (settingKey === 'Clean Content Only' && !setupData.contentSettings[settingKey]) {
                // If enabling Clean Content Only, disable all other content types
                setupData.contentSettings['Clean Content Only'] = true;
                setupData.contentSettings['NSFW Content'] = false;
                setupData.contentSettings['Swearing Allowed'] = false;
                setupData.contentSettings['Mature Themes'] = false;
                setupData.contentSettings['Adult Discussions'] = false;
            } else if (settingKey === 'Clean Content Only' && setupData.contentSettings[settingKey]) {
                // If disabling Clean Content Only
                setupData.contentSettings['Clean Content Only'] = false;
            } else if (settingKey !== 'Clean Content Only') {
                // If enabling any other content type, disable Clean Content Only
                if (!setupData.contentSettings[settingKey]) {
                    setupData.contentSettings['Clean Content Only'] = false;
                }
                setupData.contentSettings[settingKey] = !setupData.contentSettings[settingKey];
            }

            // Update button styles
            const nsfwButton = new ButtonBuilder()
                .setCustomId('content_nsfw_toggle')
                .setLabel('NSFW Content')
                .setStyle(setupData.contentSettings['NSFW Content'] ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🔞');

            const swearingButton = new ButtonBuilder()
                .setCustomId('content_swearing_toggle')
                .setLabel('Swearing Allowed')
                .setStyle(setupData.contentSettings['Swearing Allowed'] ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🤬');

            const matureButton = new ButtonBuilder()
                .setCustomId('content_mature_toggle')
                .setLabel('Mature Themes')
                .setStyle(setupData.contentSettings['Mature Themes'] ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('⚠️');

            const adultButton = new ButtonBuilder()
                .setCustomId('content_adult_toggle')
                .setLabel('Adult Discussions')
                .setStyle(setupData.contentSettings['Adult Discussions'] ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🔞');

            const cleanOnlyButton = new ButtonBuilder()
                .setCustomId('content_clean_only_toggle')
                .setLabel('Clean Content Only')
                .setStyle(setupData.contentSettings['Clean Content Only'] ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('✨');

            const continueButton = new ButtonBuilder()
                .setCustomId('content_setup_continue')
                .setLabel('Continue')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️');

            const contentRow1 = new ActionRowBuilder().addComponents(nsfwButton, swearingButton);
            const contentRow2 = new ActionRowBuilder().addComponents(matureButton, adultButton);
            const contentRow3 = new ActionRowBuilder().addComponents(cleanOnlyButton, continueButton);

            await interaction.update({
                components: [contentRow1, contentRow2, contentRow3]
            });
        }

        // Handle content setup continue
        if (interaction.customId === 'content_setup_continue') {
            const guildId = interaction.guildId;
            const guild = interaction.guild;
            const setupData = tempSetupData.get(guildId);

            if (!setupData || !setupData.contentSettings) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the process.',
                    ephemeral: true
                });
                return;
            }

            // Calculate age rating based on content settings
            let ageRating = '13+'; // Default Discord age rating
            
            if (setupData.contentSettings['Clean Content Only']) {
                ageRating = '13+'; // Clean content gets standard Discord rating
            } else if (setupData.contentSettings['NSFW Content'] || setupData.contentSettings['Adult Discussions']) {
                ageRating = '18+';
            } else if (setupData.contentSettings['Mature Themes'] || setupData.contentSettings['Swearing Allowed']) {
                ageRating = '16+';
            }

            // Store age rating
            setupData.ageRating = ageRating;

            // Show confirmation screen
            const contentSummary = Object.entries(setupData.contentSettings)
                .filter(([key, value]) => value)
                .map(([key]) => `• ${key}`)
                .join('\n') || '• Family-friendly content only';

            const confirmEmbed = new EmbedBuilder()
                .setTitle('📋 Confirm Server Details')
                .setDescription('**Please review your server information before joining the leaderboard.**')
                .addFields(
                    {
                        name: '🏷️ Server Name',
                        value: guild.name,
                        inline: true
                    },
                    {
                        name: '👥 Member Count',
                        value: guild.memberCount.toLocaleString(),
                        inline: true
                    },
                    {
                        name: '🔞 Age Rating',
                        value: ageRating,
                        inline: true
                    },
                    {
                        name: '📝 Content Settings',
                        value: contentSummary,
                        inline: false
                    },
                    {
                        name: '📢 Public Information',
                        value: 'Your server name, member count, queue activity, and content settings will be visible on the leaderboard. Server invite links will be provided for users to join.',
                        inline: false
                    }
                )
                .setColor(0x00ff00)
                .setThumbnail(guild.iconURL({ size: 128 }))
                .setFooter({ text: 'Confirm to join the SquadForge Community Leaderboard' });

            const confirmButton = new ButtonBuilder()
                .setCustomId('leaderboard_confirm')
                .setLabel('Confirm & Join Leaderboard')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId('leaderboard_setup_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const confirmRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            await interaction.update({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });
        }

        // Handle leaderboard confirmation
        if (interaction.customId === 'leaderboard_confirm') {
            const guildId = interaction.guildId;
            const guild = interaction.guild;
            const setupData = tempSetupData.get(guildId);

            if (!setupData) {
                await interaction.reply({
                    content: '❌ Setup data not found. Please restart the process.',
                    ephemeral: true
                });
                return;
            }

            try {
                // Create permanent invite for the server
                let inviteCode = null;
                try {
                    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
                    const publicChannel = channels.first();
                    
                    if (publicChannel) {
                        const invite = await publicChannel.createInvite({
                            maxAge: 0, // Never expires
                            maxUses: 0, // Unlimited uses
                            unique: true,
                            reason: 'SquadForge Community Leaderboard'
                        });
                        inviteCode = invite.code;
                    }
                } catch (inviteError) {
                    console.error('Error creating invite:', inviteError);
                }

                if (!inviteCode) {
                    await interaction.update({
                        content: '❌ **Failed to create server invite**\nI need permission to create invites for your server to join the leaderboard.\nPlease grant the "Create Instant Invite" permission and try again.',
                        embeds: [],
                        components: []
                    });
                    return;
                }

                // Save to database
                const { addServerToLeaderboard } = await import('./storage.js');
                const success = await addServerToLeaderboard(
                    guildId,
                    guild.name,
                    `A gaming community server using SquadForge for queue management`, // Default description
                    inviteCode,
                    guild.memberCount,
                    setupData.ageRating,
                    setupData.contentSettings
                );

                if (success) {
                    // Clean up temp data
                    tempSetupData.delete(guildId);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('🎉 Welcome to the SquadForge Community!')
                        .setDescription('**Your server has been successfully added to the leaderboard!**')
                        .addFields(
                            {
                                name: '📊 What happens now?',
                                value: '• Your server appears on the community leaderboard\n• Other users can discover and join your server\n• Your queue activity will be tracked and displayed\n• You can manage your listing anytime',
                                inline: false
                            },
                            {
                                name: '⚙️ Manage Your Listing',
                                value: 'Use `/server_leaderboard status` to check your position\nUse `/server_leaderboard leave` to remove your server',
                                inline: false
                            },
                            {
                                name: '🏆 Server Details',
                                value: `**Age Rating:** ${setupData.ageRating}\n**Invite Code:** ${inviteCode}\n**Status:** Active`,
                                inline: false
                            }
                        )
                        .setColor(0x00ff00)
                        .setThumbnail(guild.iconURL({ size: 128 }))
                        .setTimestamp();

                    await interaction.update({
                        embeds: [successEmbed],
                        components: []
                    });
                } else {
                    await interaction.update({
                        content: '❌ **Failed to add server to leaderboard**\nAn error occurred while processing your request. Please try again later.',
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('Error confirming leaderboard setup:', error);
                await interaction.update({
                    content: '❌ **Error adding server to leaderboard**\nPlease try again later.',
                    embeds: [],
                    components: []
                });
            }
        }

        // Handle leaderboard setup cancel
        if (interaction.customId === 'leaderboard_setup_cancel') {
            const guildId = interaction.guildId;
            
            // Clean up temp data
            tempSetupData.delete(guildId);

            await interaction.update({
                content: '❌ **Leaderboard setup cancelled**\n\nYour server was not added to the leaderboard. You can try again anytime using `/server_leaderboard join`.',
                embeds: [],
                components: []
            });
        }

        // Handle leaderboard leave confirmation
        if (interaction.customId === 'leaderboard_leave_confirm') {
            const guildId = interaction.guildId;

            try {
                const { removeServerFromLeaderboard } = await import('./storage.js');
                const success = await removeServerFromLeaderboard(guildId);

                if (success) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Server Removed from Leaderboard')
                        .setDescription('**Your server has been successfully removed from the community leaderboard.**')
                        .addFields(
                            {
                                name: '📉 What happened?',
                                value: '• Your server is no longer visible on the leaderboard\n• Users can no longer join via the server browser\n• Your queue statistics are no longer tracked publicly\n• You can rejoin anytime',
                                inline: false
                            },
                            {
                                name: '🔄 Want to rejoin?',
                                value: 'Use `/server_leaderboard join` to add your server back to the leaderboard.',
                                inline: false
                            }
                        )
                        .setColor(0x0099ff)
                        .setTimestamp();

                    await interaction.update({
                        embeds: [successEmbed],
                        components: []
                    });
                } else {
                    await interaction.update({
                        content: '❌ **Failed to remove server from leaderboard**\nAn error occurred. Please try again later.',
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('Error removing server from leaderboard:', error);
                await interaction.update({
                    content: '❌ **Error removing server from leaderboard**\nPlease try again later.',
                    embeds: [],
                    components: []
                });
            }
        }

        // Handle leaderboard leave cancel
        if (interaction.customId === 'leaderboard_leave_cancel') {
            await interaction.update({
                content: '✅ **Cancelled**\nYour server remains on the leaderboard.',
                embeds: [],
                components: []
            });
        }

        // Handle join queue button
        if (interaction.customId?.startsWith('join_queue_')) {
            const queueId = interaction.customId.replace('join_queue_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is already in a queue
            if (userQueues.has(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ You are already in a queue! Please leave your current queue first.',
                    ephemeral: true
                });
                return;
            }

            // Check if queue is full
            if (queueData.members.size >= queueData.playersNeeded) {
                await interaction.reply({
                    content: '❌ This queue is already full.',
                    ephemeral: true
                });
                return;
            }

            const hasGameRoles = queueData.gameRoles && queueData.gameRoles.length > 0;
            const rolesAreRequired = queueData.globalRoleRequirement === true;

            // If roles are required, show role selection before joining
            if (hasGameRoles && rolesAreRequired) {
                const availableRoles = queueData.gameRoles.filter(role => role.currentPlayers.length < role.maxPlayers);
                
                if (availableRoles.length === 0) {
                    await interaction.reply({
                        content: '❌ All required roles are full. Cannot join the queue.',
                        ephemeral: true
                    });
                    return;
                }

                const roleOptions = availableRoles.map((role, index) => {
                    const originalIndex = queueData.gameRoles.indexOf(role);
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(role.name)
                        .setValue(`${originalIndex}`)
                        .setDescription(`${role.currentPlayers.length}/${role.maxPlayers} players - Required`);
                });

                const roleSelect = new StringSelectMenuBuilder()
                    .setCustomId(`select_req_role_${queueId}_${interaction.user.id}`)
                    .setPlaceholder('Select a required role to join')
                    .addOptions(roleOptions);

                const roleRow = new ActionRowBuilder().addComponents(roleSelect);

                const requiredRoleEmbed = new EmbedBuilder()
                    .setTitle('🔒 Required Role Selection')
                    .setDescription(`**${queueData.gameName}** queue requires you to select a role to join.\n\nPlease select one of the available roles:`)
                    .addFields(
                        {
                            name: '📝 Available Roles',
                            value: availableRoles.map(role => 
                                `**${role.name}** - ${role.currentPlayers.length}/${role.maxPlayers} players`
                            ).join('\n'),
                            inline: false
                        }
                    )
                    .setColor(0xff0000)
                    .setFooter({ text: 'You must select a role to join this queue' });

                await interaction.reply({
                    embeds: [requiredRoleEmbed],
                    components: [roleRow],
                    ephemeral: true
                });
                return;
            }

            // Add user to queue immediately if roles are not required
            queueData.members.add(interaction.user.id);
            userQueues.set(interaction.user.id, queueId);

            // Update queue in database
            try {
                const { updateQueue } = await import('./storage.js');
                await updateQueue(queueData.guildId, queueId, {
                    players: queueData.members
                });
            } catch (updateError) {
                console.error('Error updating queue in database:', updateError);
            }

            // Assign queue role to the new member
            if (queueData.queueRoleId) {
                try {
                    const guild = interaction.guild;
                    const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                    if (queueRole) {
                        const member = await guild.members.fetch(interaction.user.id);
                        await member.roles.add(queueRole);
                    }
                } catch (roleAssignError) {
                    console.error('Error assigning queue role to new member:', roleAssignError);
                }
            }

            // Check if queue is now full
            const isQueueFull = queueData.members.size >= queueData.playersNeeded;

            // Update queue embed
            const membersArray = Array.from(queueData.members);
            const membersList = membersArray.map(id => {
                const roleIndex = queueData.memberRoles.get(id);
                const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                    ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                return `<@${id}>${roleName}`;
            }).join('\n');
            const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

            const updatedEmbed = new EmbedBuilder()
                .setAuthor({
                    name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                    iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                .addFields(
                    {
                        name: '👥 Players',
                        value: `${queueData.members.size}/${queueData.playersNeeded}`,
                        inline: true
                    },
                    {
                        name: '⏰ Available Until',
                        value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: '📝 Queue Members',
                        value: membersList,
                        inline: false
                    }
                )
                .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                .setTimestamp();

            // Add description field if it exists
            if (queueData.description) {
                updatedEmbed.addFields({
                    name: '📋 Description',
                    value: queueData.description,
                    inline: false
                });
            }

            await interaction.update({
                embeds: [updatedEmbed]
            });

            // Send notification that user joined (auto-delete after 3 seconds)
            const joinMessage = await interaction.followUp({
                content: `✅ <@${interaction.user.id}> joined the queue!`
            });

            setTimeout(async () => {
                try {
                    await joinMessage.delete();
                } catch (error) {
                    // Message might already be deleted, ignore error
                    console.log('Join notification message already deleted or not found');
                }
            }, 3000);

            // If queue is now full, ping the queue role
            if (isQueueFull && queueData.queueRoleId) {
                try {
                    const guild = interaction.guild;
                    const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                    if (queueRole) {
                        await interaction.followUp({
                            content: `🎉 **Queue is full!** <@&${queueData.queueRoleId}>\n\n**${queueData.gameName}**${queueData.gameMode ? ` - ${queueData.gameMode}` : ''} is ready to start!\n\n**Players:**\n${membersList}`,
                            allowedMentions: { roles: [queueData.queueRoleId] }
                        });
                    }
                } catch (pingError) {
                    console.error('Error pinging queue role:', pingError);
                }
            }

            // Show optional role selection if roles exist and are not required
            if (hasGameRoles && !rolesAreRequired) {
                const availableRoles = queueData.gameRoles.filter(role => role.currentPlayers.length < role.maxPlayers);
                
                if (availableRoles.length > 0) {
                    const roleOptions = availableRoles.map((role, index) => {
                        const originalIndex = queueData.gameRoles.indexOf(role);
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(role.name)
                            .setValue(`${originalIndex}`)
                            .setDescription(`${role.currentPlayers.length}/${role.maxPlayers} players - Optional`);
                    });

                    const roleSelect = new StringSelectMenuBuilder()
                        .setCustomId(`select_optional_role_${queueId}_${interaction.user.id}`)
                        .setPlaceholder('Select your game role (optional)')
                        .addOptions(roleOptions);

                    const skipButton = new ButtonBuilder()
                        .setCustomId(`skip_role_selection_${queueId}_${interaction.user.id}`)
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏭️');

                    const roleRow = new ActionRowBuilder().addComponents(roleSelect);
                    const buttonRow = new ActionRowBuilder().addComponents(skipButton);

                    const optionalRoleEmbed = new EmbedBuilder()
                        .setTitle('🎭 Optional Role Selection')
                        .setDescription(`Welcome to the **${queueData.gameName}** queue!\n\nYou can optionally select a game role or skip this step:`)
                        .addFields(
                            {
                                name: '📝 Available Roles',
                                value: availableRoles.map(role => 
                                    `**${role.name}** - ${role.currentPlayers.length}/${role.maxPlayers} players`
                                ).join('\n'),
                                inline: false
                            }
                        )
                        .setColor(0x9932cc)
                        .setFooter({ text: 'Role selection is optional for this queue' });

                    await interaction.followUp({
                        content: `<@${interaction.user.id}>`,
                        embeds: [optionalRoleEmbed],
                        components: [roleRow, buttonRow],
                        ephemeral: true
                    });
                }
            }
        }

        // Handle leave queue button
        if (interaction.customId?.startsWith('leave_queue_')) {
            const queueId = interaction.customId.replace('leave_queue_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is in this queue
            if (!queueData.members.has(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ You are not in this queue.',
                    ephemeral: true
                });
                return;
            }

            // Prevent queue owner from leaving their own queue
            if (interaction.user.id === queueData.ownerId) {
                await interaction.reply({
                    content: '❌ **Queue owners cannot leave their own queue.**\nUse the "Close Queue" button to close the queue instead.',
                    ephemeral: true
                });
                return;
            }

            // Remove user from queue
            queueData.members.delete(interaction.user.id);
            userQueues.delete(interaction.user.id);

            // Update queue in database
            try {
                const { updateQueue } = await import('./storage.js');
                await updateQueue(queueData.guildId, queueId, {
                    players: queueData.members
                });
            } catch (updateError) {
                console.error('Error updating queue in database:', updateError);
            }

            // Remove queue role from the user
            if (queueData.queueRoleId) {
                try {
                    const guild = interaction.guild;
                    const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                    if (queueRole) {
                        const member = await guild.members.fetch(interaction.user.id);
                        await member.roles.remove(queueRole);
                    }
                } catch (roleRemoveError) {
                    console.error('Error removing queue role from user:', roleRemoveError);
                }
            }

            // Remove user from any game role assignments
            const userRoleIndex = queueData.memberRoles.get(interaction.user.id);
            if (userRoleIndex !== undefined && queueData.gameRoles[userRoleIndex]) {
                const userRole = queueData.gameRoles[userRoleIndex];
                userRole.currentPlayers = userRole.currentPlayers.filter(id => id !== interaction.user.id);
                queueData.memberRoles.delete(interaction.user.id);
            }

            // Update queue embed
            const membersArray = Array.from(queueData.members);
            const membersList = membersArray.map(id => {
                const roleIndex = queueData.memberRoles.get(id);
                const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                    ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                return `<@${id}>${roleName}`;
            }).join('\n');
            const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

            const updatedEmbed = new EmbedBuilder()
                .setAuthor({
                    name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                    iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                .setDescription(`Looking for ${finalLookingForPlayers} players`)
                .addFields(
                    {
                        name: '👥 Players',
                        value: `${queueData.members.size}/${queueData.playersNeeded}`,
                        inline: true
                    },
                    {
                        name: '⏰ Available Until',
                        value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: '📝 Queue Members',
                        value: membersList || 'No members',
                        inline: false
                    }
                )
                .setColor(0x00ff00)
                .setTimestamp();

            // Add description field if it exists
            if (queueData.description) {
                updatedEmbed.addFields({
                    name: '📋 Description',
                    value: queueData.description,
                    inline: false
                });
            }

            await interaction.update({
                embeds: [updatedEmbed]
            });

            // Send notification that user left (auto-delete after 3 seconds)
            const leaveMessage = await interaction.followUp({
                content: `❌ <@${interaction.user.id}> left the queue.`
            });

            setTimeout(async () => {
                try {
                    await leaveMessage.delete();
                } catch (error) {
                    // Message might already be deleted, ignore error
                    console.log('Leave notification message already deleted or not found');
                }
            }, 3000);
        }

        // Handle close queue button
        if (interaction.customId?.startsWith('close_queue_')) {
            const queueId = interaction.customId.replace('close_queue_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is the queue owner or has admin/moderator permissions
            const isOwner = interaction.user.id === queueData.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(interaction.user.id);
            const isMod = isModerator(interaction);

            if (!isOwner && !isAdmin && !isBotAdmin && !isMod) {
                await interaction.reply({
                    content: '❌ Only the queue owner, server admins, or queue moderators can close this queue.',
                    ephemeral: true
                });
                return;
            }

            // Close the queue
            await autoDeleteQueue(queueId);

            // Get guild settings to check system type
            const guildSettings = await getGuildSettings(queueData.guildId);

            // Try to update the message, but handle cases where it might not exist
            try {
                const updatedMessage = await interaction.update({
                    content: `❌ **Queue Closed**\nClosed by <@${interaction.user.id}>`,
                    embeds: [],
                    components: [],
                    fetchReply: true
                });

                // For two-channel and single-channel systems, delete the message after 3 seconds
                if (guildSettings && (guildSettings.system_type === 'two_channel' || guildSettings.system_type === 'single_channel')) {
                    setTimeout(async () => {
                        try {
                            await updatedMessage.delete();
                        } catch (deleteError) {
                            // Message might already be deleted, ignore error
                            console.log('Queue closure message already deleted or not found');
                        }
                    }, 3000);
                }
            } catch (error) {
                // If update fails (message doesn't exist or interaction expired), try to reply
                if (error.code === 10008 || error.code === 10062) {
                    try {
                        // Check if we can still reply to the interaction
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: `❌ **Queue Closed**\nClosed by <@${interaction.user.id}>`,
                                ephemeral: true
                            });
                        }
                    } catch (replyError) {
                        // If both update and reply fail, just log it - the queue is still closed
                        console.log('Queue closed successfully but could not send notification (interaction expired)');
                    }
                } else {
                    console.error('Error updating queue closure message:', error);
                }
            }
        }

         if (interaction.customId?.startsWith('queue_owner_menu_')) {
            const queueId = interaction.customId.replace('queue_owner_menu_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is the queue owner or has admin/moderator permissions
            const isOwner = interaction.user.id === queueData.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(interaction.user.id);
            const isMod = isModerator(interaction);

            if (!isOwner && !isAdmin && !isBotAdmin && !isMod) {
                await interaction.reply({
                    content: '❌ Only the queue owner, server admins, or queue moderators can access this menu.',
                    ephemeral: true
                });
                return;
            }
             const closeButton = new ButtonBuilder()
                    .setCustomId(`close_queue_${queueId}`)
                    .setLabel('Close Queue')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔒');

             const manageRolesButton = new ButtonBuilder()
                    .setCustomId(`manage_game_roles_${queueId}`)
                    .setLabel('Manage Game Roles')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎭');

             const descriptionButton = new ButtonBuilder()
                    .setCustomId(`queue_description_${queueId}`)
                    .setLabel('Queue Description')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝');

             const ownerMenuRow1 = new ActionRowBuilder().addComponents(closeButton, manageRolesButton);
             const ownerMenuRow2 = new ActionRowBuilder().addComponents(descriptionButton);

             await interaction.reply({
                    content: `⚙️ **Queue Owner Menu**\nSelect an action:`,
                    components: [ownerMenuRow1, ownerMenuRow2],
                    ephemeral: true
                });
         }

        // Handle manage game roles button
        if (interaction.customId?.startsWith('manage_game_roles_')) {
            const queueId = interaction.customId.replace('manage_game_roles_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user has permissions to manage roles
            const isOwner = interaction.user.id === queueData.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(interaction.user.id);
            const isMod = isModerator(interaction);

            if (!isOwner && !isAdmin && !isBotAdmin && !isMod) {
                await interaction.reply({
                    content: '❌ Only the queue owner, server admins, or queue moderators can manage game roles.',
                    ephemeral: true
                });
                return;
            }

            // Store queue ID and user session data
            if (!tempSetupData.has(interaction.user.id)) {
                tempSetupData.set(interaction.user.id, {});
            }
            tempSetupData.get(interaction.user.id).currentQueueId = queueId;
            tempSetupData.get(interaction.user.id).sessionActive = true;

            const addRoleButton = new ButtonBuilder()
                .setCustomId('show_add_role_modal')
                .setLabel('Add Game Role')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕');

            const removeRoleButton = new ButtonBuilder()
                .setCustomId(`remove_game_role_${queueId}`)
                .setLabel('Remove Game Role')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
                .setDisabled(queueData.gameRoles.length === 0);

            const assignRoleButton = new ButtonBuilder()
                .setCustomId(`assign_game_role_${queueId}`)
                .setLabel('Assign Role to Member')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎯')
                .setDisabled(queueData.gameRoles.length === 0);

            const backButton = new ButtonBuilder()
                .setCustomId(`queue_owner_menu_${queueId}`)
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️');

            const roleManagementRow1 = new ActionRowBuilder().addComponents(addRoleButton, removeRoleButton);
            const roleManagementRow2 = new ActionRowBuilder().addComponents(assignRoleButton, backButton);

            const globalRequirementText = queueData.globalRoleRequirement === null ? 
                'Not set (will be set when first role is added)' : 
                (queueData.globalRoleRequirement ? 'Required' : 'Optional');

            const roleListEmbed = new EmbedBuilder()
                .setTitle('🎭 Game Role Management')
                .setDescription(`Manage game roles for **${queueData.gameName}** queue`)
                .addFields(
                    {
                        name: '🌐 Global Role Requirement',
                        value: `**${globalRequirementText}**\n${queueData.globalRoleRequirement !== null ? 'All roles in this queue follow this setting' : 'Will be set when you add the first role'}`,
                        inline: false
                    },
                    {
                        name: '📊 Current Game Roles',
                        value: queueData.gameRoles.length > 0 ? 
                            queueData.gameRoles.map((role, index) => 
                                `**${index + 1}.** ${role.name} (${role.currentPlayers.length}/${role.maxPlayers})`
                            ).join('\n') : 
                            'No game roles created yet',
                        inline: false
                    },
                    {
                        name: '📝 Available Actions',
                        value: '• Add new game role (max 5)\n• Remove existing role\n• Assign role to member',
                        inline: false
                    }
                )
                .setColor(0x9932cc)
                .setFooter({ text: `Queue: ${queueData.gameName}` });

            await interaction.update({
                embeds: [roleListEmbed],
                components: [roleManagementRow1, roleManagementRow2]
            });
        }

        // Handle show add role modal button (simplified approach)
        if (interaction.customId === 'show_add_role_modal') {
            const userData = tempSetupData.get(interaction.user.id);
            if (!userData || !userData.currentQueueId || !userData.sessionActive) {
                await interaction.reply({
                    content: '❌ Session expired. Please go back to the queue owner menu and try again.',
                    ephemeral: true
                });
                return;
            }

            const queueId = userData.currentQueueId;
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (queueData.gameRoles.length >= 5) {
                await interaction.reply({
                    content: '❌ Maximum of 5 game roles allowed per queue.',
                    ephemeral: true
                });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('simple_add_role_modal')
                .setTitle('Add Game Role');

            const roleNameInput = new TextInputBuilder()
                .setCustomId('role_name')
                .setLabel('Role Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Tank, Support, DPS, IGL')
                .setRequired(true)
                .setMaxLength(25);

            const maxPlayersInput = new TextInputBuilder()
                .setCustomId('max_players')
                .setLabel('Max Players for this Role')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('1-10')
                .setRequired(true)
                .setMaxLength(2);

            const roleNameRow = new ActionRowBuilder().addComponents(roleNameInput);
            const maxPlayersRow = new ActionRowBuilder().addComponents(maxPlayersInput);

            modal.addComponents(roleNameRow, maxPlayersRow);
            await interaction.showModal(modal);
        }

        // Handle simple add role modal submission
        if (interaction.customId === 'simple_add_role_modal') {
            const userData = tempSetupData.get(interaction.user.id);
            if (!userData || !userData.currentQueueId) {
                await interaction.reply({
                    content: '❌ Session expired. Please try again.',
                    ephemeral: true
                });
                return;
            }

            const queueId = userData.currentQueueId;
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            const roleName = interaction.fields.getTextInputValue('role_name').trim();
            const maxPlayersInput = interaction.fields.getTextInputValue('max_players').trim();

            // Validate role name
            if (!roleName || roleName.length < 2) {
                await interaction.reply({
                    content: '❌ Role name must be at least 2 characters long.',
                    ephemeral: true
                });
                return;
            }

            // Check if role name already exists
            if (queueData.gameRoles.some(role => role.name.toLowerCase() === roleName.toLowerCase())) {
                await interaction.reply({
                    content: '❌ A role with this name already exists.',
                    ephemeral: true
                });
                return;
            }

            // Validate max players
            if (!maxPlayersInput || isNaN(maxPlayersInput)) {
                await interaction.reply({
                    content: '❌ Max players must be a valid number between 1 and 10.',
                    ephemeral: true
                });
                return;
            }

            const maxPlayers = parseInt(maxPlayersInput);
            if (maxPlayers < 1 || maxPlayers > 10) {
                await interaction.reply({
                    content: '❌ Max players must be between 1 and 10.',
                    ephemeral: true
                });
                return;
            }

            // Check if this is the first role being added
            if (queueData.globalRoleRequirement === null) {
                // Store role data temporarily for the toggle selection
                if (!userData.tempRoleData) {
                    userData.tempRoleData = {};
                }
                userData.tempRoleData = {
                    name: roleName,
                    maxPlayers: maxPlayers
                };

                // Show toggle buttons for required status
                const requiredButton = new ButtonBuilder()
                    .setCustomId(`set_role_required_${queueId}`)
                    .setLabel('Required')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const optionalButton = new ButtonBuilder()
                    .setCustomId(`set_role_optional_${queueId}`)
                    .setLabel('Optional')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔓');

                const toggleRow = new ActionRowBuilder().addComponents(requiredButton, optionalButton);

                const toggleEmbed = new EmbedBuilder()
                    .setTitle('🎭 Set Role Requirement (First Role)')
                    .setDescription(`**Role:** ${roleName}\n**Max Players:** ${maxPlayers}\n\nThis is your first game role. All future roles will follow this setting.\n\nAre game roles required for this queue?`)
                    .addFields(
                        {
                            name: '🔒 Required',
                            value: 'Players must select a role to join the queue',
                            inline: true
                        },
                        {
                            name: '🔓 Optional',
                            value: 'Players can join with or without selecting a role',
                            inline: true
                        }
                    )
                    .setColor(0x9932cc);

                await interaction.reply({
                    embeds: [toggleEmbed],
                    components: [toggleRow],
                    ephemeral: true
                });
            } else {
                // Global requirement is already set, add role directly
                queueData.gameRoles.push({
                    name: roleName,
                    maxPlayers: maxPlayers,
                    currentPlayers: []
                });

                // Clean up user session data but maintain session for continued use
                if (userData.tempRoleData) {
                    delete userData.tempRoleData;
                }

                const requirementStatus = queueData.globalRoleRequirement ? 'Required' : 'Optional';

                await interaction.reply({
                    content: `✅ **Game role added successfully!**\n**Role:** ${roleName}\n**Max Players:** ${maxPlayers}\n**Status:** ${requirementStatus} (following queue's global setting)`,
                    ephemeral: true
                });

                // Refresh the game role management embed
                await refreshGameRoleManagementEmbed(interaction, queueId);
            }
        }

        // Handle remove game role button
        if (interaction.customId?.startsWith('remove_game_role_')) {
            const queueId = interaction.customId.replace('remove_game_role_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (queueData.gameRoles.length === 0) {
                await interaction.reply({
                    content: '❌ No game roles to remove.',
                    ephemeral: true
                });
                return;
            }

            const roleOptions = queueData.gameRoles.map((role, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(role.name)
                    .setValue(`${index}`)
                    .setDescription(`${role.currentPlayers.length}/${role.maxPlayers} players - ${role.isRequired ? 'Required' : 'Optional'}`)
            );

            const roleSelect = new StringSelectMenuBuilder()
                .setCustomId(`confirm_remove_game_role_${queueId}`)
                .setPlaceholder('Select a role to remove')
                .addOptions(roleOptions);

            const selectRow = new ActionRowBuilder().addComponents(roleSelect);

            await interaction.reply({
                content: 'Select which game role to remove:',
                components: [selectRow],
                ephemeral: true
            });
        }

        // Handle confirm remove game role
        if (interaction.customId?.startsWith('confirm_remove_game_role_')) {
            const queueId = interaction.customId.replace('confirm_remove_game_role_', '');
            const queueData = activeQueues.get(queueId);
            const roleIndex = parseInt(interaction.values[0]);

            if (!queueData || !queueData.gameRoles[roleIndex]) {
                await interaction.reply({
                    content: '❌ Role not found.',
                    ephemeral: true
                });
                return;
            }

            const removedRole = queueData.gameRoles[roleIndex];
            
            // Remove role assignments for this role
            for (const [userId, userRoleIndex] of queueData.memberRoles.entries()) {
                if (userRoleIndex === roleIndex) {
                    queueData.memberRoles.delete(userId);
                } else if (userRoleIndex > roleIndex) {
                    // Adjust indices for roles after the removed one
                    queueData.memberRoles.set(userId, userRoleIndex - 1);
                }
            }

            // Remove the role
            queueData.gameRoles.splice(roleIndex, 1);

            await interaction.update({
                content: `✅ **Game role "${removedRole.name}" removed successfully!**\nAll player assignments for this role have been cleared.`,
                components: []
            });
        }

        // Handle assign game role button
        if (interaction.customId?.startsWith('assign_game_role_')) {
            const queueId = interaction.customId.replace('assign_game_role_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (queueData.gameRoles.length === 0) {
                await interaction.reply({
                    content: '❌ No game roles available to assign.',
                    ephemeral: true
                });
                return;
            }

            // Create member select options
            const memberOptions = Array.from(queueData.members).map(userId => {
                const member = interaction.guild.members.cache.get(userId);
                const currentRole = queueData.memberRoles.get(userId);
                const currentRoleName = currentRole !== undefined ? queueData.gameRoles[currentRole]?.name || 'Unknown' : 'None';
                
                return new StringSelectMenuOptionBuilder()
                    .setLabel(member?.displayName || 'Unknown Member')
                    .setValue(userId)
                    .setDescription(`Current role: ${currentRoleName}`);
            });

            const memberSelect = new StringSelectMenuBuilder()
                .setCustomId(`select_member_for_role_${queueId}`)
                .setPlaceholder('Select a member to assign role to')
                .addOptions(memberOptions);

            const selectRow = new ActionRowBuilder().addComponents(memberSelect);

            await interaction.reply({
                content: 'Select which member to assign a role to:',
                components: [selectRow],
                ephemeral: true
            });
        }

        // Handle member selection for role assignment
        if (interaction.customId?.startsWith('select_member_for_role_')) {
            const queueId = interaction.customId.replace('select_member_for_role_', '');
            const queueData = activeQueues.get(queueId);
            const selectedUserId = interaction.values[0];

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Create role select options
            const roleOptions = queueData.gameRoles.map((role, index) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(role.name)
                    .setValue(`${index}`)
                    .setDescription(`${role.currentPlayers.length}/${role.maxPlayers} players - ${role.isRequired ? 'Required' : 'Optional'}`)
            );

            // Add option to remove role
            roleOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Remove Role Assignment')
                    .setValue('remove')
                    .setDescription('Remove current role from this member')
            );

            const roleSelect = new StringSelectMenuBuilder()
                .setCustomId(`assign_role_to_member_${queueId}_${selectedUserId}`)
                .setPlaceholder('Select a role to assign')
                .addOptions(roleOptions);

            const selectRow = new ActionRowBuilder().addComponents(roleSelect);

            const member = interaction.guild.members.cache.get(selectedUserId);
            await interaction.update({
                content: `Select which role to assign to **${member?.displayName || 'Unknown Member'}**:`,
                components: [selectRow]
            });
        }

        // Handle role requirement toggle buttons
        if (interaction.customId?.startsWith('set_role_required_') || interaction.customId?.startsWith('set_role_optional_')) {
            const isRequired = interaction.customId.startsWith('set_role_required_');
            const queueId = interaction.customId.split('_').slice(3).join('_');
            const userData = tempSetupData.get(interaction.user.id);

            if (!userData || !userData.currentQueueId || !userData.tempRoleData) {
                await interaction.reply({
                    content: '❌ Session expired. Please try again.',
                    ephemeral: true
                });
                return;
            }

            const queueData = activeQueues.get(queueId);
            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            const roleData = userData.tempRoleData;

            // Set global role requirement if not already set
            if (queueData.globalRoleRequirement === null) {
                queueData.globalRoleRequirement = isRequired;
            }

            // Add the role with the global requirement setting
            queueData.gameRoles.push({
                name: roleData.name,
                maxPlayers: roleData.maxPlayers,
                currentPlayers: []
            });

            // Clean up temp role data but keep session active
            delete userData.tempRoleData;

            const requirementStatus = queueData.globalRoleRequirement ? 'Required' : 'Optional';
            const globalMessage = queueData.gameRoles.length === 1 ? 
                `\n**Global Setting:** All game roles in this queue are now ${requirementStatus.toLowerCase()}` : 
                `\n**Global Setting:** Following queue's ${requirementStatus.toLowerCase()} role policy`;

            await interaction.update({
                content: `✅ **Game role added successfully!**\n**Role:** ${roleData.name}\n**Max Players:** ${roleData.maxPlayers}${globalMessage}`,
                embeds: [],
                components: []
            });

            // Refresh the game role management embed after a short delay
            setTimeout(async () => {
                await refreshGameRoleManagementEmbed(interaction, queueId);
            }, 1500);
        }

        // Handle role assignment confirmation
        if (interaction.customId?.startsWith('assign_role_to_member_')) {
            const parts = interaction.customId.replace('assign_role_to_member_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const selectedUserId = parts[parts.length - 1];
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            const selectedValue = interaction.values[0];
            const member = interaction.guild.members.cache.get(selectedUserId);

            if (selectedValue === 'remove') {
                // Remove role assignment
                const currentRoleIndex = queueData.memberRoles.get(selectedUserId);
                if (currentRoleIndex !== undefined && queueData.gameRoles[currentRoleIndex]) {
                    const currentRole = queueData.gameRoles[currentRoleIndex];
                    currentRole.currentPlayers = currentRole.currentPlayers.filter(id => id !== selectedUserId);
                    queueData.memberRoles.delete(selectedUserId);
                    
                    // Update the main queue embed to show the role removal
                    const channel = interaction.guild.channels.cache.get(queueData.channelId);
                    if (channel) {
                        try {
                            // Find the queue message and update it
                            const messages = await channel.messages.fetch({ limit: 10 });
                            const queueMessage = messages.find(msg => 
                                msg.embeds.length > 0 && 
                                msg.embeds[0].title && 
                                msg.embeds[0].title.includes(queueData.gameName)
                            );

                            if (queueMessage) {
                                // Update queue embed
                                const membersArray = Array.from(queueData.members);
                                const membersList = membersArray.map(id => {
                                    const roleIndex = queueData.memberRoles.get(id);
                                    const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                        ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                                    return `<@${id}>${roleName}`;
                                }).join('\n');
                                const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                                const updatedEmbed = new EmbedBuilder()
                                    .setAuthor({
                                        name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                        iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                                    })
                                    .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                                    .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                                    .addFields(
                                        {
                                            name: '👥 Players',
                                            value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                            inline: true
                                        },
                                        {
                                            name: '⏰ Available Until',
                                            value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                            inline: true
                                        },
                                        {
                                            name: '📝 Queue Members',
                                            value: membersList,
                                            inline: false
                                        }
                                    )
                                    .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                                    .setTimestamp();

                                await queueMessage.edit({ embeds: [updatedEmbed] });
                            }
                        } catch (error) {
                            console.error('Error updating queue message after role removal:', error);
                        }
                    }
                    
                    await interaction.update({
                        content: `✅ **Role assignment removed!**\n**${member?.displayName || 'Unknown Member'}** no longer has a game role.`,
                        components: []
                    });
                } else {
                    await interaction.update({
                        content: `❌ **${member?.displayName || 'Unknown Member'}** doesn't have a role assigned.`,
                        components: []
                    });
                }
                return;
            }

            const roleIndex = parseInt(selectedValue);
            const selectedRole = queueData.gameRoles[roleIndex];

            if (!selectedRole) {
                await interaction.update({
                    content: '❌ Role not found.',
                    components: []
                });
                return;
            }

            // Check if role is full
            if (selectedRole.currentPlayers.length >= selectedRole.maxPlayers) {
                await interaction.update({
                    content: `❌ **Role "${selectedRole.name}" is full!**\nCurrent players: ${selectedRole.currentPlayers.length}/${selectedRole.maxPlayers}`,
                    components: []
                });
                return;
            }

            // Remove user from previous role if they had one
            const previousRoleIndex = queueData.memberRoles.get(selectedUserId);
            if (previousRoleIndex !== undefined && queueData.gameRoles[previousRoleIndex]) {
                const previousRole = queueData.gameRoles[previousRoleIndex];
                previousRole.currentPlayers = previousRole.currentPlayers.filter(id => id !== selectedUserId);
            }

            // Assign new role
            selectedRole.currentPlayers.push(selectedUserId);
            queueData.memberRoles.set(selectedUserId, roleIndex);

            // Update the main queue embed to show the role assignment
            const channel = interaction.guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    // Find the queue message and update it
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const queueMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title && 
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        // Update queue embed
                        const membersArray = Array.from(queueData.members);
                        const membersList = membersArray.map(id => {
                            const roleIndex = queueData.memberRoles.get(id);
                            const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                            return `<@${id}>${roleName}`;
                        }).join('\n');
                        const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                        const updatedEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                            .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                            .addFields(
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '📝 Queue Members',
                                    value: membersList,
                                    inline: false
                                }
                            )
                            .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                            .setTimestamp();

                        await queueMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating queue message after role assignment:', error);
                }
            }

            await interaction.update({
                content: `✅ **Role assigned successfully!**\n**${member?.displayName || 'Unknown Member'}** is now assigned to **${selectedRole.name}**\nRole capacity: ${selectedRole.currentPlayers.length}/${selectedRole.maxPlayers}`,
                components: []
            });
        }

        // Handle required role selection when joining queue
        if (interaction.customId?.startsWith('select_req_role_')) {
            const parts = interaction.customId.replace('select_req_role_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const userId = parts[parts.length - 1];
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (interaction.user.id !== userId) {
                await interaction.reply({
                    content: '❌ You can only select roles for yourself.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is already in a queue
            if (userQueues.has(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ You are already in a queue! Please leave your current queue first.',
                    ephemeral: true
                });
                return;
            }

            // Check if queue is full
            if (queueData.members.size >= queueData.playersNeeded) {
                await interaction.reply({
                    content: '❌ This queue is already full.',
                    ephemeral: true
                });
                return;
            }

            const roleIndex = parseInt(interaction.values[0]);
            const selectedRole = queueData.gameRoles[roleIndex];

            if (!selectedRole) {
                await interaction.reply({
                    content: '❌ Invalid role selection.',
                    ephemeral: true
                });
                return;
            }

            // Verify that roles are actually required for this queue
            if (queueData.globalRoleRequirement !== true) {
                await interaction.reply({
                    content: '❌ Roles are not required for this queue.',
                    ephemeral: true
                });
                return;
            }

            // Check if role is full
            if (selectedRole.currentPlayers.length >= selectedRole.maxPlayers) {
                await interaction.reply({
                    content: `❌ **Role "${selectedRole.name}" is full!**\nPlease select another role.`,
                    ephemeral: true
                });
                return;
            }

            // Add user to queue and assign role
            queueData.members.add(interaction.user.id);
            userQueues.set(interaction.user.id, queueId);
            selectedRole.currentPlayers.push(interaction.user.id);
            queueData.memberRoles.set(interaction.user.id, roleIndex);

            // Update queue in database
            try {
                const { updateQueue } = await import('./storage.js');
                await updateQueue(queueData.guildId, queueId, {
                    players: queueData.members
                });
            } catch (updateError) {
                console.error('Error updating queue in database:', updateError);
            }

            // Assign queue role to the new member
            if (queueData.queueRoleId) {
                try {
                    const guild = interaction.guild;
                    const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                    if (queueRole) {
                        const member = await guild.members.fetch(interaction.user.id);
                        await member.roles.add(queueRole);
                    }
                } catch (roleAssignError) {
                    console.error('Error assigning queue role to new member:', roleAssignError);
                }
            }

            // Check if queue is now full
            const isQueueFull = queueData.members.size >= queueData.playersNeeded;

            // Update queue embed in the main channel
            const channel = interaction.guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const queueMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title && 
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        const membersArray = Array.from(queueData.members);
                        const membersList = membersArray.map(id => {
                            const roleIndex = queueData.memberRoles.get(id);
                            const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                            return `<@${id}>${roleName}`;
                        }).join('\n');
                        const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                        const updatedEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                            .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                            .addFields(
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '📝 Queue Members',
                                    value: membersList,
                                    inline: false
                                }
                            )
                            .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                            .setTimestamp();

                        await queueMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating queue message:', error);
                }
            }

            await interaction.update({
                content: `✅ **Joined queue successfully!**\nYou joined **${queueData.gameName}** as **${selectedRole.name}**\nRole capacity: ${selectedRole.currentPlayers.length}/${selectedRole.maxPlayers}`,
                embeds: [],
                components: []
            });

            // Send notification in main channel (auto-delete after 3 seconds)
            if (channel) {
                const joinRoleMessage = await channel.send(`✅ <@${interaction.user.id}> joined the queue as **${selectedRole.name}**!`);
                
                setTimeout(async () => {
                    try {
                        await joinRoleMessage.delete();
                    } catch (error) {
                        // Message might already be deleted, ignore error
                        console.log('Join with role notification message already deleted or not found');
                    }
                }, 3000);

                // If queue is now full, ping the queue role
                if (isQueueFull && queueData.queueRoleId) {
                    try {
                        const guild = interaction.guild;
                        const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                        if (queueRole) {
                            const membersArray = Array.from(queueData.members);
                            const membersList = membersArray.map(id => {
                                const roleIndex = queueData.memberRoles.get(id);
                                const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                    ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                                return `<@${id}>${roleName}`;
                            }).join('\n');

                            await channel.send({
                                content: `🎉 **Queue is full!** <@&${queueData.queueRoleId}>\n\n**${queueData.gameName}**${queueData.gameMode ? ` - ${queueData.gameMode}` : ''} is ready to start!\n\n**Players:**\n${membersList}`,
                                allowedMentions: { roles: [queueData.queueRoleId] }
                            });
                        }
                    } catch (pingError) {
                        console.error('Error pinging queue role:', pingError);
                    }
                }
            }
        }

        // Handle optional role selection when joining queue
        if (interaction.customId?.startsWith('select_optional_role_')) {
            const parts = interaction.customId.replace('select_optional_role_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const userId = parts[parts.length - 1];
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (interaction.user.id !== userId) {
                await interaction.reply({
                    content: '❌ You can only select roles for yourself.',
                    ephemeral: true
                });
                return;
            }

            const roleIndex = parseInt(interaction.values[0]);
            const selectedRole = queueData.gameRoles[roleIndex];

            if (!selectedRole) {
                await interaction.reply({
                    content: '❌ Role not found.',
                    ephemeral: true
                });
                return;
            }

            // Check if role is full
            if (selectedRole.currentPlayers.length >= selectedRole.maxPlayers) {
                await interaction.reply({
                    content: `❌ **Role "${selectedRole.name}" is full!**\nPlease select another role or skip.`,
                    ephemeral: true
                });
                return;
            }

            // Assign role
            selectedRole.currentPlayers.push(userId);
            queueData.memberRoles.set(userId, roleIndex);

            // Update the main queue embed to show the role assignment
            const channel = interaction.guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const queueMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title && 
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        const membersArray = Array.from(queueData.members);
                        const membersList = membersArray.map(id => {
                            const roleIndex = queueData.memberRoles.get(id);
                            const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                            return `<@${id}>${roleName}`;
                        }).join('\n');
                        const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                        const updatedEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                            .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                            .addFields(
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '📝 Queue Members',
                                    value: membersList,
                                    inline: false
                                }
                            )
                            .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                            .setTimestamp();

                        await queueMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating queue message after optional role selection:', error);
                }
            }

            await interaction.update({
                content: `✅ **Role selected successfully!**\nYou are now assigned to **${selectedRole.name}**\nRole capacity: ${selectedRole.currentPlayers.length}/${selectedRole.maxPlayers}`,
                embeds: [],
                components: []
            });
        }

        // Handle skip role selection button
        if (interaction.customId?.startsWith('skip_role_selection_')) {
            const parts = interaction.customId.replace('skip_role_selection_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const userId = parts[parts.length - 1];

            if (interaction.user.id !== userId) {
                await interaction.reply({
                    content: '❌ You can only make decisions for yourself.',
                    ephemeral: true
                });
                return;
            }

            await interaction.update({
                content: `✅ **Role selection skipped**\nYou can select a role later through the queue owner menu if needed.`,
                embeds: [],
                components: []
            });
        }

        // Handle role selection when joining queue
        if (interaction.customId?.startsWith('select_role_on_join_')) {
            const parts = interaction.customId.replace('select_role_on_join_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const userId = parts[parts.length - 1];
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            if (interaction.user.id !== userId) {
                await interaction.reply({
                    content: '❌ You can only select roles for yourself.',
                    ephemeral: true
                });
                return;
            }

            const roleIndex = parseInt(interaction.values[0]);
            const selectedRole = queueData.gameRoles[roleIndex];

            if (!selectedRole) {
                await interaction.reply({
                    content: '❌ Role not found.',
                    ephemeral: true
                });
                return;
            }

            // Check if role is full
            if (selectedRole.currentPlayers.length >= selectedRole.maxPlayers) {
                await interaction.reply({
                    content: `❌ **Role "${selectedRole.name}" is full!**\nPlease select another role.`,
                    ephemeral: true
                });
                return;
            }

            // Assign role
            selectedRole.currentPlayers.push(userId);
            queueData.memberRoles.set(userId, roleIndex);

            // Update the main queue embed to show the role assignment
            const channel = interaction.guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    // Find the queue message and update it
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const queueMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title && 
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        // Update queue embed
                        const membersArray = Array.from(queueData.members);
                        const membersList = membersArray.map(id => {
                            const roleIndex = queueData.memberRoles.get(id);
                            const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                            return `<@${id}>${roleName}`;
                        }).join('\n');
                        const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                        const updatedEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                            .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                            .addFields(
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '📝 Queue Members',
                                    value: membersList,
                                    inline: false
                                }
                            )
                            .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                            .setTimestamp();

                        await queueMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating queue message after role selection:', error);
                }
            }

            await interaction.update({
                content: `✅ **Role selected successfully!**\nYou are now assigned to **${selectedRole.name}**\nRole capacity: ${selectedRole.currentPlayers.length}/${selectedRole.maxPlayers}`,
                embeds: [],
                components: []
            });
        }

        // Handle "Maybe Later" button for role selection
        if (interaction.customId?.startsWith('maybe_later_role_')) {
            const parts = interaction.customId.replace('maybe_later_role_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const userId = parts[parts.length - 1];

            if (interaction.user.id !== userId) {
                await interaction.reply({
                    content: '❌ You can only make decisions for yourself.',
                    ephemeral: true
                });
                return;
            }

            await interaction.update({
                content: `📝 **Role selection postponed**\nYou can select a role later through the queue owner or when prompted again.`,
                embeds: [],
                components: []
            });
        }

        // Handle join searched queue button
        if (interaction.customId?.startsWith('join_searched_queue_')) {
            const parts = interaction.customId.replace('join_searched_queue_', '').split('_');
            const queueId = parts.slice(0, -1).join('_');
            const searchUserId = parts[parts.length - 1];

            if (interaction.user.id !== searchUserId) {
                await interaction.reply({
                    content: '❌ You can only join queues from your own search notifications.',
                    ephemeral: true
                });
                return;
            }

            const queueData = activeQueues.get(queueId);
            if (!queueData) {
                await interaction.update({
                    content: '❌ **This queue no longer exists.**\nThe queue may have been closed or expired.',
                    embeds: [],
                    components: []
                });
                return;
            }

            // Check if user is already in a queue
            if (userQueues.has(interaction.user.id)) {
                await interaction.update({
                    content: '❌ **You are already in a queue!**\nPlease leave your current queue before joining another one.',
                    embeds: [],
                    components: []
                });
                return;
            }

            // Check if queue is full
            if (queueData.members.size >= queueData.playersNeeded) {
                await interaction.update({
                    content: '❌ **This queue is now full.**\nSomeone else joined while you were deciding.',
                    embeds: [],
                    components: []
                });
                return;
            }

            try {
                const guild = clientInstance.guilds.cache.get(queueData.guildId);
                if (!guild) {
                    throw new Error('Guild not found');
                }

                // Get the user as a guild member
                const member = await guild.members.fetch(interaction.user.id);
                if (!member) {
                    await interaction.update({
                        content: '❌ **Unable to join queue.**\nYou may not be a member of the server where this queue was created.',
                        embeds: [],
                        components: []
                    });
                    return;
                }

                const hasGameRoles = queueData.gameRoles && queueData.gameRoles.length > 0;
                const rolesAreRequired = queueData.globalRoleRequirement === true;

                // If roles are required, check if any are available
                if (hasGameRoles && rolesAreRequired) {
                    const availableRoles = queueData.gameRoles.filter(role => role.currentPlayers.length < role.maxPlayers);
                    
                    if (availableRoles.length === 0) {
                        await interaction.update({
                            content: '❌ **All required roles are full.**\nCannot join the queue at this time.',
                            embeds: [],
                            components: []
                        });
                        return;
                    }
                }

                // Add user to queue
                queueData.members.add(interaction.user.id);
                userQueues.set(interaction.user.id, queueId);

                // Update queue in database
                try {
                    const { updateQueue } = await import('./storage.js');
                    await updateQueue(queueData.guildId, queueId, {
                        players: queueData.members
                    });
                } catch (updateError) {
                    console.error('Error updating queue in database:', updateError);
                }

                // Assign queue role to the new member
                if (queueData.queueRoleId) {
                    try {
                        const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                        if (queueRole) {
                            await member.roles.add(queueRole);
                        }
                    } catch (roleAssignError) {
                        console.error('Error assigning queue role to search user:', roleAssignError);
                    }
                }

                // Remove the user's queue search since they joined a queue
                if (global.activeQueueSearches.has(interaction.user.id)) {
                    global.activeQueueSearches.delete(interaction.user.id);
                    // Also remove from database
                    try {
                        const { removeQueueSearch } = await import('./storage.js');
                        await removeQueueSearch(interaction.user.id);
                    } catch (error) {
                        console.error('Error removing queue search from database:', error);
                    }
                }

                await interaction.update({
                    content: '✅ **Successfully joined the queue!**\nYou\'ve been added to the queue. Check the server for more details.',
                    embeds: [],
                    components: []
                });

                // Update the queue in the server
                const channel = guild.channels.cache.get(queueData.channelId);
                if (channel) {
                    try {
                        const messages = await channel.messages.fetch({ limit: 10 });
                        const queueMessage = messages.find(msg => 
                            msg.embeds.length > 0 && 
                            msg.embeds[0].title && 
                            msg.embeds[0].title.includes(queueData.gameName)
                        );

                        if (queueMessage) {
                            const membersArray = Array.from(queueData.members);
                            const membersList = membersArray.map(id => {
                                const roleIndex = queueData.memberRoles.get(id);
                                const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                    ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                                return `<@${id}>${roleName}`;
                            }).join('\n');
                            const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                            const updatedEmbed = new EmbedBuilder()
                                .setAuthor({
                                    name: ` ${guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                    iconURL: guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                                })
                                .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                                .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                                .addFields(
                                    {
                                        name: '👥 Players',
                                        value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                        inline: true
                                    },
                                    {
                                        name: '⏰ Available Until',
                                        value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                        inline: true
                                    },
                                    {
                                        name: '📝 Queue Members',
                                        value: membersList,
                                        inline: false
                                    }
                                )
                                .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                                .setTimestamp();

                            // Add description field if it exists
                            if (queueData.description) {
                                updatedEmbed.addFields({
                                    name: '📋 Description',
                                    value: queueData.description,
                                    inline: false
                                });
                            }

                            await queueMessage.edit({ embeds: [updatedEmbed] });

                            // Send notification in the queue channel
                            const joinMessage = await channel.send(`✅ <@${interaction.user.id}> joined the queue from queue search!`);
                            
                            setTimeout(async () => {
                                try {
                                    await joinMessage.delete();
                                } catch (error) {
                                    console.log('Join notification message already deleted or not found');
                                }
                            }, 3000);

                            // If queue is now full, ping the queue role
                            if (queueData.members.size >= queueData.playersNeeded && queueData.queueRoleId) {
                                try {
                                    const queueRole = guild.roles.cache.get(queueData.queueRoleId);
                                    if (queueRole) {
                                        await channel.send({
                                            content: `🎉 **Queue is full!** <@&${queueData.queueRoleId}>\n\n**${queueData.gameName}**${queueData.gameMode ? ` - ${queueData.gameMode}` : ''} is ready to start!\n\n**Players:**\n${membersList}`,
                                            allowedMentions: { roles: [queueData.queueRoleId] }
                                        });
                                    }
                                } catch (pingError) {
                                    console.error('Error pinging queue role:', pingError);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error updating queue message after search join:', error);
                    }
                }

            } catch (error) {
                console.error('Error joining queue from search:', error);
                await interaction.update({
                    content: '❌ **Error joining queue.**\nPlease try again or join manually through the server.',
                    embeds: [],
                    components: []
                });
            }
        }

        // Handle ignore searched queue button
        if (interaction.customId?.startsWith('ignore_searched_queue_')) {
            const searchUserId = interaction.customId.replace('ignore_searched_queue_', '');

            if (interaction.user.id !== searchUserId) {
                await interaction.reply({
                    content: '❌ You can only manage your own search notifications.',
                    ephemeral: true
                });
                return;
            }

            await interaction.update({
                content: '📝 **Queue notification ignored.**\nYour queue search is still active and you\'ll be notified of other matching queues.',
                embeds: [],
                components: []
            });
        }

        // Handle queue description button
        if (interaction.customId?.startsWith('queue_description_')) {
            const queueId = interaction.customId.replace('queue_description_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            // Check if user is the queue owner or has admin/moderator permissions
            const isOwner = interaction.user.id === queueData.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(interaction.user.id);
            const isMod = isModerator(interaction);

            if (!isOwner && !isAdmin && !isBotAdmin && !isMod) {
                await interaction.reply({
                    content: '❌ Only the queue owner, server admins, or queue moderators can edit the queue description.',
                    ephemeral: true
                });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`edit_queue_description_${queueId}`)
                .setTitle('Edit Queue Description');

            const descriptionInput = new TextInputBuilder()
                .setCustomId('queue_description_text')
                .setLabel('Queue Description (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe your needs, playstyle, or who you\'re looking for...')
                .setRequired(false)
                .setMaxLength(1000)
                .setValue(queueData.description || '');

            const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
            modal.addComponents(descriptionRow);

            await interaction.showModal(modal);
        }

        // Handle queue description modal submission
        if (interaction.customId?.startsWith('edit_queue_description_')) {
            const queueId = interaction.customId.replace('edit_queue_description_', '');
            const queueData = activeQueues.get(queueId);

            if (!queueData) {
                await interaction.reply({
                    content: '❌ This queue no longer exists.',
                    ephemeral: true
                });
                return;
            }

            const newDescription = interaction.fields.getTextInputValue('queue_description_text').trim();
            
            // Update queue description
            queueData.description = newDescription || null;

            // Update the queue embed in the channel
            const channel = interaction.guild.channels.cache.get(queueData.channelId);
            if (channel) {
                try {
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const queueMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title && 
                        msg.embeds[0].title.includes(queueData.gameName)
                    );

                    if (queueMessage) {
                        const membersArray = Array.from(queueData.members);
                        const membersList = membersArray.map(id => {
                            const roleIndex = queueData.memberRoles.get(id);
                            const roleName = roleIndex !== undefined && queueData.gameRoles[roleIndex] ? 
                                ` - **${queueData.gameRoles[roleIndex].name}**` : '';
                            return `<@${id}>${roleName}`;
                        }).join('\n');
                        const finalLookingForPlayers = queueData.playersNeeded - queueData.members.size;

                        const updatedEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: ` ${interaction.guild.members.cache.get(queueData.ownerId)?.displayName ?? 'Unknown'}👑`,
                                iconURL: interaction.guild.members.cache.get(queueData.ownerId)?.user.displayAvatarURL({ dynamic: true })
                            })
                            .setTitle(`🎮 ${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`)
                            .setDescription(finalLookingForPlayers > 0 ? `Looking for ${finalLookingForPlayers} players` : '🎉 Queue is full! Get ready to play!')
                            .addFields(
                                {
                                    name: '👥 Players',
                                    value: `${queueData.members.size}/${queueData.playersNeeded}`,
                                    inline: true
                                },
                                {
                                    name: '⏰ Available Until',
                                    value: `<t:${Math.floor(queueData.endTime / 1000)}:R>`,
                                    inline: true
                                },
                                {
                                    name: '📝 Queue Members',
                                    value: membersList,
                                    inline: false
                                }
                            )
                            .setColor(queueData.members.size >= queueData.playersNeeded ? 0xffd700 : 0x00ff00)
                            .setTimestamp();

                        // Add description field if it exists
                        if (queueData.description) {
                            updatedEmbed.addFields({
                                name: '📋 Description',
                                value: queueData.description,
                                inline: false
                            });
                        }

                        await queueMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating queue message with description:', error);
                }
            }

            if (newDescription) {
                await interaction.reply({
                    content: `✅ **Queue description updated successfully!**\n\n**New description:**\n${newDescription}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `✅ **Queue description removed successfully!**`,
                    ephemeral: true
                });
            }
        }

        // Add any other missing interaction handlers here
    });
}