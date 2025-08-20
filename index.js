
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, Collection, REST, Routes } from 'discord.js';
import { setupInteractionHandlers, setupselection } from './interactions.js';
import { connectDB } from './storage.js';
import * as commands from './commands/index.js';

const discordToken = process.env.DISCORD_TOKEN;

// Debug token loading
if (!discordToken) {
    console.error('❌ DISCORD_TOKEN environment variable is not set!');
    console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('DISCORD')));
    process.exit(1);
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize commands collection
client.commands = new Collection();

// Add all commands from the commands module
Object.values(commands).forEach(command => {
    client.commands.set(command.data.name, command);
});

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log('\n🎮 SquadForge Bot Starting...');
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log('successfully finished startup')

    const serverCount = client.guilds.cache.size;
    client.user.setActivity(`To ${serverCount} servers`, { type: 1 });
    console.log(`📊 Connected to ${serverCount} server${serverCount !== 1 ? 's' : ''}`);

    client.on('guildCreate', () => {
      updateBotStatus();
    });

    client.on('guildDelete', () => {
      updateBotStatus();
    });

    function updateBotStatus() {
      const serverCount = client.guilds.cache.size;
      client.user.setActivity(`To ${serverCount} servers`, { type: 1 });
    }

    // Initialize database connection
    console.log('🔌 Connecting to database...');
    const { connectDB, startDatabaseReconnectionAttempts } = await import('./storage.js');
    await connectDB();
    
    // Start periodic reconnection attempts
    startDatabaseReconnectionAttempts();

    // Load data from database
    console.log('📚 Loading bot data...');
    const { loadFunCommandStates, loadQueues, loadQueueSearches, loadModerationRoles, reconstructQueueChannels } = await import('./storage.js');
    await loadFunCommandStates();
    await loadQueues();
    await loadQueueSearches();
    await loadModerationRoles();

    // Reconstruct queue channels after loading
    await reconstructQueueChannels(client);

    // Register slash commands
    console.log('⚡ Registering slash commands...');
    const rest = new REST().setToken(discordToken);
    try {
        const commandData = Object.values(commands).map(command => command.data.toJSON());
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandData },
        );
        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }

    // Setup interaction handlers
    setupInteractionHandlers(client);
    setupselection(client);

    // Run permission diagnostics for all guilds
    console.log('🔍 Running permission diagnostics...');
    let guildsWithIssues = 0;
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const hasIssues = await runPermissionDiagnostics(guild);
            if (hasIssues) guildsWithIssues++;
        } catch (error) {
            console.error(`❌ Permission check failed for guild ${guild.name}:`, error.message);
            guildsWithIssues++;
        }
    }
    
    if (guildsWithIssues === 0) {
        console.log('✅ All servers have proper permissions');
    } else {
        console.log(`⚠️  ${guildsWithIssues} server${guildsWithIssues !== 1 ? 's have' : ' has'} permission issues`);
    }

    console.log('\n🚀 SquadForge Bot is ready!\n');
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Add error event handlers
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', warn => {
    console.warn('⚠️ Discord client warning:', warn);
});

client.on('debug', info => {
    // Only show important debug messages
    if (info.includes('heartbeat') || 
        info.includes('Sending a heartbeat') || 
        info.includes('Provided token') ||
        info.includes('Preparing to connect') ||
        info.includes('Fetched Gateway') ||
        info.includes('Session Limit') ||
        info.includes('Connecting to') ||
        info.includes('Waiting for') ||
        info.includes('Identifying') ||
        info.includes('shard')) return;
    console.log('🐛 Discord debug:', info);
});

// Handle process errors
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Handle permission errors specifically
client.on('shardError', error => {
    console.error('❌ Discord shard error:', error);
});

// Permission diagnostics function
async function runPermissionDiagnostics(guild) {
    const botMember = guild.members.me;
    if (!botMember) return false;

    // Check basic permissions
    const requiredPermissions = [
        { name: 'Send Messages', flag: PermissionFlagsBits.SendMessages },
        { name: 'View Channels', flag: PermissionFlagsBits.ViewChannel },
        { name: 'Read Message History', flag: PermissionFlagsBits.ReadMessageHistory },
        { name: 'Use Slash Commands', flag: PermissionFlagsBits.UseApplicationCommands },
        { name: 'Embed Links', flag: PermissionFlagsBits.EmbedLinks },
        { name: 'Manage Channels', flag: PermissionFlagsBits.ManageChannels },
        { name: 'Manage Roles', flag: PermissionFlagsBits.ManageRoles },
        { name: 'Create Instant Invite', flag: PermissionFlagsBits.CreateInstantInvite },
        { name: 'Add Reactions', flag: PermissionFlagsBits.AddReactions },
        { name: 'Mention Everyone', flag: PermissionFlagsBits.MentionEveryone }
    ];

    let missingPermissions = [];
    
    for (const perm of requiredPermissions) {
        const hasPermission = botMember.permissions.has(perm.flag);
        if (!hasPermission) {
            missingPermissions.push(perm.name);
        }
    }

    // Check role hierarchy
    const botRole = botMember.roles.highest;
    const everyoneRole = guild.roles.everyone;
    const canManageRoles = botRole.position > everyoneRole.position;
    
    if (!canManageRoles) {
        missingPermissions.push('Proper Role Hierarchy');
    }

    // Check guild settings and specific channel permissions
    try {
        const { getGuildSettings } = await import('./storage.js');
        const guildSettings = await getGuildSettings(guild.id);
        
        if (guildSettings) {
            // Check specific channel permissions
            const channelIds = [
                guildSettings.queue_channel_id,
                guildSettings.creation_channel_id,
                guildSettings.display_channel_id,
                guildSettings.single_channel_id,
                guildSettings.queue_category_id
            ].filter(Boolean);

            for (const channelId of channelIds) {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    const channelPerms = channel.permissionsFor(botMember);
                    const canSend = channelPerms?.has(PermissionFlagsBits.SendMessages);
                    
                    if (!canSend && channel.type !== ChannelType.GuildCategory) {
                        missingPermissions.push(`Send Messages in #${channel.name}`);
                    }
                }
            }
        }
    } catch (error) {
        // Silent error handling for cleaner output
    }

    // Only show detailed output if there are issues
    if (missingPermissions.length > 0) {
        console.log(`\n⚠️  ${guild.name}: Missing permissions`);
        missingPermissions.forEach(perm => console.log(`   • ${perm}`));
        return true;
    }
    
    return false;
}

// Log in to Discord with your client's token
client.login(discordToken);

//welcome message
client.on('guildCreate', guild => {
    const channel = guild.channels.cache.find(channel => 
        channel.type === ChannelType.GuildText && 
        channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
    );

    if (!channel) return; // Return if no suitable channel is found

    // Create a welcome embed
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎮 Welcome to SquadForge! 🎮')
        .setDescription('**The ultimate gaming companion for your server!**')
        .addFields(
            { 
                name: '🔥 What I Do', 
                value: 'I help your server members find teammates and gaming buddies for their favorite games!', 
                inline: false 
            },
            { 
                name: '⚡ Quick Start', 
                value: 'Click the button below or use `/setup` to get started', 
                inline: false 
            },
            { 
                name: '🚀 Features', 
                value: '• Find gaming partners\n• Create squads\n• Match with similar players\n• Join gaming events', 
                inline: false 
            },
            {
                name: 'Please check permissions',
                value: 'If the bot doesn\'t send the message in the channel that you configured, please give the bot permission override for that channel with the necessary permissions and make sure the bot has the same permissions for the server.',
            }
        )
        .setColor(0x00ff00)
        .setFooter({ text: 'Ready to forge your squad?' })
        .setTimestamp();

    // Create a server invite link button
    const inviteButton = new ButtonBuilder()
        .setLabel('Official Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/yfXdqFSC')

    // Create a setup button
    const setupButton = new ButtonBuilder()
        .setCustomId('setup_bot')
        .setLabel('🛠️ Setup SquadForge')
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder()
        .addComponents(setupButton, inviteButton);

    channel.send({ 
        embeds: [welcomeEmbed], 
        components: [actionRow] 
    });
});
