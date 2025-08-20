import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, SectionBuilder, MessageFlags, Component, ChannelType, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { handleSetupCommand, handleRefreshCommand, handleSettingsCommand, } from './interactions.js';
import { saveFunCommandState, saveQueueSearch, removeQueueSearch } from './storage.js';

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

export const updateLogCommand = {
  data: new SlashCommandBuilder()
    .setName('update_log')
    .setDescription('Shows the latest update log for SquadForge')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    try {
      // Read update log from JSON file
      const fs = await import('fs/promises');
      const updateLogData = JSON.parse(await fs.readFile('./updateLog.json', 'utf8'));

      const updateEmbed = new EmbedBuilder()
        .setTitle('📋 SquadForge Update Log')
        .setDescription(`**Latest Version: ${updateLogData.version}** • Last Updated: ${updateLogData.lastUpdated}`)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: 'SquadForge Bot', iconURL: interaction.client.user.displayAvatarURL() });

      // Filter visible updates and get the latest 3
      const visibleUpdates = updateLogData.updates.filter(update => update.visible !== false);
      const recentUpdates = visibleUpdates.slice(0, 3);

      recentUpdates.forEach(update => {
        const featuresText = update.features.join('\n');
        updateEmbed.addFields({
          name: `${update.title} (${update.date})`,
          value: featuresText,
          inline: false
        });
      });

      await interaction.reply({
        embeds: [updateEmbed],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error reading update log:', error);

      // Fallback embed if file can't be read
      const fallbackEmbed = new EmbedBuilder()
        .setTitle('📋 SquadForge Update Log')
        .setDescription('**Unable to load update log**')
        .addFields({
          name: 'Error',
          value: 'Could not fetch the latest updates. Please try again later.',
          inline: false
        })
        .setColor(0xff0000)
        .setTimestamp();

      await interaction.reply({
        embeds: [fallbackEmbed],
        ephemeral: true
      });
    }
  }
}

export const dictionaryCommand = {
  data: new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Look up the meaning of a word')
    .addStringOption(option =>
      option.setName('word')
        .setDescription('The word to define')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('ephemeral')
        .setDescription('Only you can see the result (default: false)')
        .setRequired(false)
    )
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('dictionary')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    const query = interaction.options.getString('word').toLowerCase().trim();
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    const words = query.split(/\s+/);

    // Word limit
    if (words.length > 5) {
      await interaction.reply({
        content: '❌ You can only search up to **5 words** at a time.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral });

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${query}`);
      const data = await response.json();

      if (!Array.isArray(data) || !data[0]?.meanings?.length) {
        await interaction.editReply({
          content: `❌ No definitions found for **${query}**.`,
        });
        return;
      }

      const wordData = data[0];
      const word = wordData.word;
      const phonetic = wordData.phonetic || '';
      const meanings = wordData.meanings;

      const makeEmbedForMeaning = (meaning) => {
        const embed = new EmbedBuilder()
          .setTitle(`📖 ${word} (${meaning.partOfSpeech})`)
          .setDescription(phonetic ? `*Phonetic:* \`${phonetic}\`` : null)
          .setColor(0x4b91f1)
          .setTimestamp();

        const defs = meaning.definitions.slice(0, 3);
        defs.forEach((def, index) => {
          embed.addFields({
            name: `Definition ${index + 1}`,
            value: def.definition
          });
          if (def.example) {
            embed.addFields({
              name: '💬 Example',
              value: def.example
            });
          }
        });

        if (defs[0].synonyms?.length) {
          embed.addFields({
            name: '🔁 Synonyms',
            value: defs[0].synonyms.slice(0, 5).join(', ')
          });
        }

        if (defs[0].antonyms?.length) {
          embed.addFields({
            name: '↔️ Antonyms',
            value: defs[0].antonyms.slice(0, 5).join(', ')
          });
        }

        return embed;
      };

      const defaultMeaning = meanings[0];
      const embed = makeEmbedForMeaning(defaultMeaning);

      const options = meanings.map((m, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.partOfSpeech)
          .setValue(String(i))
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_pos_${query}_${interaction.id}`)
        .setPlaceholder('Choose word form')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const msg = await interaction.editReply({
        embeds: [embed],
        components: meanings.length > 1 ? [row] : [],
        fetchReply: true
      });

      if (meanings.length > 1) {
        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        collector.on('collect', async (selectInteraction) => {
          if (selectInteraction.user.id !== interaction.user.id) {
            await selectInteraction.reply({
              content: '❌ You can’t interact with this menu.',
              ephemeral: true
            });
            return;
          }

          const selectedIndex = parseInt(selectInteraction.values[0]);
          const selectedMeaning = meanings[selectedIndex];
          const newEmbed = makeEmbedForMeaning(selectedMeaning);

          await selectInteraction.update({ embeds: [newEmbed] });
        });

        collector.on('end', async () => {
          await interaction.editReply({ components: [] }).catch(() => {});
        });
      }

    } catch (err) {
      console.error('Dictionary API Error:', err);
      await interaction.editReply({
        content: '❌ Failed to fetch word data. Try again later.'
      });
    }
  }
};

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

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Shows bot uptime, server count, and recent queue activity')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    await interaction.deferReply();

    // Uptime
    const uptimeMs = interaction.client.uptime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptime = formatUptime(uptimeSeconds);

    // Server count
    const serverCount = interaction.client.guilds.cache.size;

    // Total Users
    const totalUsers = interaction.client.users.cache.size;

    // Count queues created in last 7 days from database
    let queueStats = { recentQueues: 'N/A', totalQueues: 'N/A' };

    try {
      const { getQueueStatistics } = await import('./storage.js');
      queueStats = await getQueueStatistics();
    } catch (error) {
      console.error('Error fetching queue statistics:', error);
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 SquadForge Bot Status')
        .setDescription('**Real-time bot statistics and performance metrics**')
        .addFields(
            {
                name: '🌐 Network Stats',
                value: `**Servers:** ${serverCount}\n**Total Users:** ${totalUsers.toLocaleString()}\n**Uptime:** ${formatUptime(uptimeSeconds)}`,
                inline: true
            },
            {
                name: '🎮 Queue Activity',
                value: `**This Week:** ${queueStats.recentQueues.toLocaleString()}\n**All Time:** ${queueStats.totalQueues.toLocaleString()}\n**Success Rate:** ${queueStats.totalQueues > 0 ? Math.round((queueStats.recentQueues / Math.max(queueStats.totalQueues, 1)) * 100) : 0}%`,
                inline: true
            },
            {
                name: '⚡ Performance',
                value: `**Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n**Package version:** Node.js ${process.version}\n**Ping:** ${interaction.client.ws.ping}ms`,
                inline: true
            }
        )
        .setColor(0x7289da)
        .setThumbnail(interaction.client.user.displayAvatarURL({ size: 128 }))
        .setFooter({ 
            text: `SquadForge v2.0 • Serving ${serverCount} server${serverCount !== 1 ? 's' : ''}`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

// Helper function
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

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

export const catCommand = {
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Sends a random cat picture!')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('cat')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    await interaction.deferReply();

    try {
      const response = await fetch('https://api.thecatapi.com/v1/images/search?limit=1&api_key=live_lhZTppp1zQjiSAFRipReigbwgpfvLvhrKL012M8VthmYl2NCKfpmAYgjdyZvnmSu');
      const data = await response.json();
      const cat = data[0];
      const catImageUrl = cat?.url;
      const breed = cat.breeds?.[0];
      const CatTitles = ["here's a lovely cat photo!", "here's a cute cat!", "here's a cat!", "here's a cat photo!","here's a cat photo... well I think so.","here's a splendid cat","Here's a beautiful cat!","cute cat isn't it?"]
      const RandomCatTitle = CatTitles[Math.floor(Math.random() * CatTitles.length)];

      if (!catImageUrl) {
        return interaction.editReply('😿 Could not fetch a cat picture right now. Try again later.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🐱'+ RandomCatTitle)
        .setImage(catImageUrl)
        .setColor(0x00AE86);

      // Only add the button if there's breed info
      if (breed) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('show_info')
            .setLabel('📖 Show Info')
            .setStyle(ButtonStyle.Primary)
        );

        const message = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15_000,
          max: 1,
          filter: i => i.user.id === interaction.user.id,
        });

        collector.on('collect', async i => {
          if (i.customId === 'show_info') {
            embed.setTitle(`🐱 ${breed.name}`)
              .setDescription(breed.description || 'No description available.')
              .setColor(0x00AE86)
              .addFields(
                { name: 'Origin', value: breed.origin || 'Unknown', inline: true },
                { name: 'Temperament', value: breed.temperament || 'Unknown', inline: true }
              );
            await i.update({ embeds: [embed], components: [] }); // remove button
          }
        });

        collector.on('end', async collected => {
          if (collected.size === 0) {
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('show_info')
                .setLabel('📖 Show Info')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );
            await message.edit({ components: [disabledRow] });
          }
        });

      } else {
        // No breed info – just send the image
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error('Cat API error:', err);
      await interaction.editReply('❌ Failed to fetch cat. The API might be down.');
    }
  }
};

export const dogCommand = {
  data: new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Sends a random dog picture!')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('dog')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    await interaction.deferReply();

    try {
      const response = await fetch('https://api.thedogapi.com/v1/images/search?limit=1&api_key=live_lhZTppp1zQjiSAFRipReigbwgpfvLvhrKL012M8VthmYl2NCKfpmAYgjdyZvnmSu');
      const data = await response.json();
      const dog = data[0];
      const dogImageUrl = dog?.url;
      const breed = dog.breeds?.[0];

      if (!dogImageUrl) {
        return interaction.editReply('🐶 Could not fetch a dog picture right now. Try again later.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🐶 Here’s a cute dog!')
        .setImage(dogImageUrl)
        .setColor(0xff9900);

      // Only add the button if breed info exists
      if (breed) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('show_info')
            .setLabel('📖 Show Info')
            .setStyle(ButtonStyle.Primary)
        );

        const message = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15_000,
          max: 1,
          filter: i => i.user.id === interaction.user.id,
        });

        collector.on('collect', async i => {
          if (i.customId === 'show_info') {
            embed.setTitle(`🐶 ${breed.name}`)
              .setDescription(breed.description || 'No description available.')
              .addFields(
                { name: 'Origin', value: breed.origin || 'Unknown', inline: true },
                { name: 'Temperament', value: breed.temperament || 'Unknown', inline: true }
              );
            await i.update({ embeds: [embed], components: [] }); // remove button
          }
        });

        collector.on('end', async collected => {
          if (collected.size === 0) {
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('show_info')
                .setLabel('📖 Show Info')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );
            await message.edit({ components: [disabledRow] });
          }
        });

      } else {
        // No breed info – just send the image
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error('Dog API error:', err);
      await interaction.editReply('❌ Failed to fetch dog. The API might be down.');
    }
  }
};

export const supportServerCommand = {
    data: new SlashCommandBuilder()
        .setName('support_server')
        .setDescription('Join the official SquadForge server')
        .setDMPermission(true)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

        async execute(interaction) {
            const supportServerInvite = ['https://discord.gg/rquG7Nu5'];
            await interaction .reply({
                content: `Join the official SquadForge server to get support and stay updated!\n${supportServerInvite}`,
                ephemeral: true
            })
        },
};

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

export const queueSearchCommand = {
  data: new SlashCommandBuilder()
    .setName('queue_search')
    .setDescription('Search for a specific game queue and get notified when one is found')
    .addStringOption(option =>
      option.setName('game')
        .setDescription('The game you want to search for')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addIntegerOption(option =>
      option.setName('search_time')
        .setDescription('How long to search for a queue (1-8 hours)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(8)
    )
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Game mode (optional)')
        .setRequired(false)
        .setMaxLength(50)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const gameName = interaction.options.getString('game');
    const gameMode = interaction.options.getString('mode');
    const searchTime = interaction.options.getInteger('search_time');

    // Initialize queue searches if not exists
    if (!global.activeQueueSearches) {
      global.activeQueueSearches = new Map();
    }

    // Check if user already has an active search
    if (global.activeQueueSearches.has(userId)) {
      await interaction.reply({
        content: '❌ **You already have an active queue search!**\nUse `/cancel_queue_search` to cancel your current search before starting a new one.',
        ephemeral: true
      });
      return;
    }

    const searchData = {
      userId: userId,
      guildId: guildId,
      gameName: gameName.toLowerCase(),
      gameMode: gameMode ? gameMode.toLowerCase() : null,
      searchTime: searchTime,
      startTime: Date.now(),
      endTime: Date.now() + (searchTime * 60 * 60 * 1000)
    };

    // Store the search in memory and database
    global.activeQueueSearches.set(userId, searchData);

    // Save to database
    try {
      await saveQueueSearch(searchData);
      console.log(`Queue search saved for user: ${userId}`);
    } catch (error) {
      console.error('Error saving queue search to database:', error);
    }

    // Set timeout to automatically cancel search
    setTimeout(async () => {
      if (global.activeQueueSearches.has(userId)) {
        global.activeQueueSearches.delete(userId);
        // Also remove from database when timeout expires
        try {
          await removeQueueSearch(userId);
        } catch (error) {
          console.error('Error removing expired queue search from database:', error);
        }
      }
    }, searchTime * 60 * 60 * 1000);

    const searchEmbed = new EmbedBuilder()
      .setTitle('🔍 Queue Search Active')
      .setDescription(`**Searching for: ${gameName}**${gameMode ? ` - ${gameMode}` : ''}`)
      .addFields(
        {
          name: '⏰ Search Duration',
          value: `${searchTime} hour${searchTime > 1 ? 's' : ''}`,
          inline: true
        },
        {
          name: '📍 Server',
          value: interaction.guild.name,
          inline: true
        },
        {
          name: '🔔 Notification',
          value: 'You\'ll receive a DM when a matching queue is found',
          inline: false
        }
      )
      .setColor(0x00ff00)
      .setFooter({ text: 'Use /cancel_queue_search to stop searching' })
      .setTimestamp();

    await interaction.reply({
      embeds: [searchEmbed],
      ephemeral: true
    });
  }
};

export const cancelQueueSearchCommand = {
  data: new SlashCommandBuilder()
    .setName('cancel_queue_search')
    .setDescription('Cancel your active queue search'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Check if user has an active search
    if (!global.activeQueueSearches || !global.activeQueueSearches.has(userId)) {
      await interaction.reply({
        content: '❌ **You don\'t have an active queue search to cancel.**',
        ephemeral: true
      });
      return;
    }

    const searchData = global.activeQueueSearches.get(userId);
    // Remove the search from memory and database
    global.activeQueueSearches.delete(userId);

    try {
      await removeQueueSearch(userId);
      console.log(`Queue search removed for user: ${userId}`);
    } catch (error) {
      console.error('Error removing queue search from database:', error);
    }

    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ Queue Search Cancelled')
      .setDescription(`Your queue search for **${searchData.gameName}**${searchData.gameMode ? ` - ${searchData.gameMode}` : ''} has been cancelled.`)
      .setColor(0xff0000)
      .setTimestamp();

    await interaction.reply({
      embeds: [cancelEmbed],
      ephemeral: true
    });
  }
};

export const setupNewsChannelCommand = {
  data: new SlashCommandBuilder()
    .setName('setup_news_channel')
    .setDescription('Set the channel for SquadForge bot news and updates')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to receive bot news and updates')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const selectedChannel = interaction.options.getChannel('channel');

    const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

    // Check if user has admin permissions
    if (!isServerAdmin && !isBotAdmin) {
      await interaction.reply({
        content: '❌ **You are not admin for this server**\nPlease contact an admin to setup the news channel',
        ephemeral: true
      });
      return;
    }

    // Check if bot has permission to send messages in the selected channel
    const botMember = interaction.guild.members.me;
    if (!selectedChannel.permissionsFor(botMember).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({
        content: '❌ **Bot Missing Channel Permissions**\nI need the "Send Messages" permission in the selected channel.\nPlease contact a server admin to grant this permission.',
        ephemeral: true
      });
      return;
    }

    try {
      const { saveNewsChannel } = await import('./storage.js');
      const success = await saveNewsChannel(guildId, selectedChannel.id);

      if (success) {
        const successEmbed = new EmbedBuilder()
          .setTitle('📰 News Channel Setup Complete!')
          .setDescription(`**SquadForge news and updates will now be sent to ${selectedChannel}**`)
          .addFields(
            {
              name: '📢 What you\'ll receive',
              value: '• Bot updates and new features\n• Important announcements\n• Server-wide notifications',
              inline: false
            },
            {
              name: '⚙️ Settings',
              value: `**Channel:** ${selectedChannel}\n**Status:** Active`,
              inline: false
            }
          )
          .setColor(0x00ff00)
          .setTimestamp()
          .setFooter({ text: 'You can change this channel anytime by running this command again' });

        await interaction.reply({
          embeds: [successEmbed],
          ephemeral: true
        });

        // Send a test message to the channel
        const testEmbed = new EmbedBuilder()
          .setTitle('📰 SquadForge News Channel Active!')
          .setDescription('This channel has been set up to receive SquadForge bot news and updates.')
          .setColor(0x0099ff)
          .setTimestamp()
          .setFooter({ text: 'SquadForge Bot News' });

        await selectedChannel.send({ embeds: [testEmbed] });

      } else {
        await interaction.reply({
          content: '❌ **Failed to setup news channel**\nPlease try again later.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error setting up news channel:', error);
      await interaction.reply({
        content: '❌ **An error occurred while setting up the news channel**\nPlease try again later.',
        ephemeral: true
      });
    }
  }
};

export const serverStatsCommand = {
  data: new SlashCommandBuilder()
    .setName('server_stats')
    .setDescription('View detailed statistics for this server\'s queue activity'),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    try {
      const { getServerStatistics } = await import('./storage.js');
      const stats = await getServerStatistics(guildId);

      // Get current active queues count
      const { activeQueues } = await import('./interactions.js');
      const currentActiveQueues = Array.from(activeQueues.values()).filter(queue => queue.guildId === guildId).length;

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guildName} Queue Statistics`)
        .setDescription('**Detailed queue activity and performance metrics for this server**')
        .addFields(
          {
            name: '🎮 Queue Activity (This Week)',
            value: `**New Queues:** ${stats.weeklyQueues.toLocaleString()}\n**Daily Average:** ${stats.dailyAverage}\n**Growth:** ${stats.weeklyGrowth}`,
            inline: true
          },
          {
            name: '📊 Overall Stats',
            value: `**All Time Queues:** ${stats.totalQueues.toLocaleString()}\n**Currently Active:** ${currentActiveQueues}\n**Success Rate:** ${stats.successRate}%`,
            inline: true
          },
          {
            name: '👥 Player Stats',
            value: `**Total Players:** ${stats.totalPlayers.toLocaleString()}\n**Unique Players:** ${stats.uniquePlayers.toLocaleString()}\n**Avg Queue Size:** ${stats.averageQueueSize}`,
            inline: true
          },
          {
            name: '📅 Peak Activity',
            value: `**Peak Day:** ${stats.peakDay || 'No data'}\n**Avg Duration:** ${stats.averageDuration}`,
            inline: true
          },
          {
            name: '🏆 Top Games',
            value: stats.topGames.length > 0 ? 
              stats.topGames.slice(0, 5).map((game, i) => `**${i + 1}.** ${game.name} (${game.count})`).join('\n') :
              'No games queued yet',
            inline: true
          },
          {
            name: '🏅 Server Badges',
            value: 'Coming Soon!\nServer badges will be displayed here based on achievements and milestones.',
            inline: false
          }
        )
        .setColor(0x0099ff)
        .setThumbnail(interaction.guild.iconURL({ size: 128 }))
        .setFooter({ 
          text: `${guildName} • Data since server setup`, 
          iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

      // Add a field for recent activity if there's data
      if (stats.recentActivity && stats.recentActivity.length > 0) {
        const recentActivityText = stats.recentActivity
          .slice(0, 3)
          .map(activity => `• ${activity.game} - ${activity.timeAgo}`)
          .join('\n');

        embed.addFields({
          name: '🕒 Recent Activity',
          value: recentActivityText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching server statistics:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Statistics Unavailable')
        .setDescription('Unable to fetch server statistics at this time.')
        .addFields({
          name: 'Error',
          value: 'Please try again later or contact support if the issue persists.',
          inline: false
        })
        .setColor(0xff0000)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

export const leaveAllQueuesCommand = {
  data: new SlashCommandBuilder()
    .setName('leave_all_queues')
    .setDescription('Leave all queues you are in and close all queues you own'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Import queue management functions
    const { activeQueues, userQueues, autoDeleteQueue } = await import('./interactions.js');
    const { updateQueue } = await import('./storage.js');

    // Find all queues the user is involved in
    const userMemberQueues = [];
    const userOwnedQueues = [];

    for (const [queueId, queueData] of activeQueues.entries()) {
      if (queueData.ownerId === userId) {
        userOwnedQueues.push({ queueId, queueData });
      } else if (queueData.members.has(userId)) {
        userMemberQueues.push({ queueId, queueData });
      }
    }

    // Check if user is involved in any queues
    if (userMemberQueues.length === 0 && userOwnedQueues.length === 0) {
      await interaction.reply({
        content: '❌ **You are not involved in any queues.**\nYou are not a member or owner of any active queues.',
        ephemeral: true
      });
      return;
    }

    try {
      const results = {
        leftQueues: [],
        closedQueues: [],
        errors: []
      };

      // Leave queues where user is a member (but not owner)
      for (const { queueId, queueData } of userMemberQueues) {
        try {
          // Remove user from the queue
          queueData.members.delete(userId);
          userQueues.delete(userId);

          // Remove user from any game role assignments
          const userRoleIndex = queueData.memberRoles.get(userId);
          if (userRoleIndex !== undefined && queueData.gameRoles[userRoleIndex]) {
            const userRole = queueData.gameRoles[userRoleIndex];
            userRole.currentPlayers = userRole.currentPlayers.filter(id => id !== userId);
            queueData.memberRoles.delete(userId);
          }

          // Update queue in database
          await updateQueue(queueData.guildId, queueId, {
            players: queueData.members
          });

          // Remove queue role from the user
          if (queueData.queueRoleId) {
            try {
              const guild = interaction.guild;
              const queueRole = guild.roles.cache.get(queueData.queueRoleId);
              if (queueRole) {
                const member = await guild.members.fetch(userId);
                await member.roles.remove(queueRole);
              }
            } catch (roleRemoveError) {
              console.error('Error removing queue role from user:', roleRemoveError);
            }
          }

          // Update the queue message if possible
          const channel = interaction.guild.channels.cache.get(queueData.channelId);
          if (channel) {
            try {
              const messages = await channel.messages.fetch({ limit: 20 });
              const queueMessage = messages.find(msg => 
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title &&
                msg.embeds[0].title.includes(queueData.gameName)
              );

              if (queueMessage) {
                const { EmbedBuilder } = await import('discord.js');

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

                await queueMessage.edit({ embeds: [updatedEmbed] });

                // Send notification in the queue channel (auto-delete after 3 seconds)
                const leaveMessage = await channel.send(`❌ <@${userId}> left the queue.`);
                setTimeout(async () => {
                  try {
                    await leaveMessage.delete();
                  } catch (error) {
                    console.log('Leave notification message already deleted or not found');
                  }
                }, 3000);
              }
            } catch (updateError) {
              console.error('Error updating queue message:', updateError);
            }
          }

          results.leftQueues.push(`${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`);
        } catch (error) {
          console.error(`Error leaving queue ${queueId}:`, error);
          results.errors.push(`Failed to leave ${queueData.gameName}`);
        }
      }

      // Close queues where user is the owner
      for (const { queueId, queueData } of userOwnedQueues) {
        try {
          await autoDeleteQueue(queueId);
          results.closedQueues.push(`${queueData.gameName}${queueData.gameMode ? ` - ${queueData.gameMode}` : ''}`);
        } catch (error) {
          console.error(`Error closing queue ${queueId}:`, error);
          results.errors.push(`Failed to close ${queueData.gameName}`);
        }
      }

      // Create success response
      const { EmbedBuilder } = await import('discord.js');
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Queue Operations Complete')
        .setColor(0x00ff00)
        .setTimestamp();

      let description = '';
      let fields = [];

      if (results.leftQueues.length > 0) {
        fields.push({
          name: '📤 Left Queues',
          value: results.leftQueues.map(queue => `• ${queue}`).join('\n'),
          inline: false
        });
        description += `Left ${results.leftQueues.length} queue${results.leftQueues.length > 1 ? 's' : ''}`;
      }

      if (results.closedQueues.length > 0) {
        fields.push({
          name: '🔒 Closed Queues',
          value: results.closedQueues.map(queue => `• ${queue}`).join('\n'),
          inline: false
        });
        if (description) description += ' and ';
        description += `closed ${results.closedQueues.length} queue${results.closedQueues.length > 1 ? 's' : ''}`;
      }

      if (results.errors.length > 0) {
        fields.push({
          name: '❌ Errors',
          value: results.errors.map(error => `• ${error}`).join('\n'),
          inline: false
        });
        successEmbed.setColor(0xff9900); // Orange for partial success
      }

      successEmbed.setDescription(description);
      if (fields.length > 0) {
        successEmbed.addFields(...fields);
      }

      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in leave all queues command:', error);
      await interaction.reply({
        content: '❌ **Error processing queue operations**\nAn error occurred while processing your queues. Please try again.',
        ephemeral: true
      });
    }
  }
};

export const moderatorRoleCommand = {
  data: new SlashCommandBuilder()
    .setName('moderator_role')
    .setDescription('Manage queue moderator roles')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a moderator role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to grant queue moderation permissions')
            .setRequired(true)
        ))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a moderator role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to remove queue moderation permissions from')
            .setRequired(true)
        ))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List current moderator roles')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

    // Check if user has admin permissions
    if (!isServerAdmin && !isBotAdmin) {
      await interaction.reply({
        content: '❌ **You are not admin for this server**\nPlease contact an admin to manage moderator roles.',
        ephemeral: true
      });
      return;
    }

    // Initialize moderator roles storage if it doesn't exist
    if (!global.moderatorRolesByGuildId) {
      global.moderatorRolesByGuildId = {};
    }
    if (!global.moderatorRolesByGuildId[guildId]) {
      global.moderatorRolesByGuildId[guildId] = new Set();
    }

    const moderatorRoles = global.moderatorRolesByGuildId[guildId];

    if (subcommand === 'add') {
      const role = interaction.options.getRole('role');

      if (moderatorRoles.has(role.id)) {
        await interaction.reply({
          content: `❌ **${role.name}** is already a moderator role.`,
          ephemeral: true
        });
        return;
      }

      moderatorRoles.add(role.id);

      try {
        const { saveModerationRole } = await import('./storage.js');
        await saveModerationRole(guildId, role.id, true);
      } catch (error) {
        console.error('Error saving moderator role:', error);
      }

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Moderator Role Added')
        .setDescription(`**${role.name}** has been granted queue moderation permissions.`)
        .addFields({
          name: '🛡️ Moderator Abilities',
          value: '• Close any queue\n• Kick players from queues\n• Manage queue roles\n• View all queue controls',
          inline: false
        })
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true
      });

    } else if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');

      if (!moderatorRoles.has(role.id)) {
        await interaction.reply({
          content: `❌ **${role.name}** is not a moderator role.`,
          ephemeral: true
        });
        return;
      }

      moderatorRoles.delete(role.id);

      try {
        const { saveModerationRole } = await import('./storage.js');
        await saveModerationRole(guildId, role.id, false);
      } catch (error) {
        console.error('Error removing moderator role:', error);
      }

      await interaction.reply({
        content: `✅ **${role.name}** has been removed from moderator roles.`,
        ephemeral: true
      });

    } else if (subcommand === 'list') {
      if (moderatorRoles.size === 0) {
        await interaction.reply({
          content: '📋 **No moderator roles configured**\nUse `/moderator_role add` to add moderator roles.',
          ephemeral: true
        });
        return;
      }

      const roleList = Array.from(moderatorRoles)
        .map(roleId => {
          const role = interaction.guild.roles.cache.get(roleId);
          return role ? `<@&${roleId}>` : `Unknown Role (${roleId})`;
        })
        .join('\n');

      const listEmbed = new EmbedBuilder()
        .setTitle('🛡️ Queue Moderator Roles')
        .setDescription(roleList)
        .addFields({
          name: '📊 Summary',
          value: `**Total Roles:** ${moderatorRoles.size}`,
          inline: false
        })
        .setColor(0x0099ff)
        .setTimestamp();

      await interaction.reply({
        embeds: [listEmbed],
        ephemeral: true
      });
    }
  }
};

export const serverLeaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('server_leaderboard')
    .setDescription('Manage your server\'s leaderboard presence')
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Add your server to the community leaderboard'))
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Remove your server from the leaderboard'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check your server\'s leaderboard status')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    const isServerAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isBotAdmin = global.botAdminsByGuildId?.[guildId]?.has(userId);

    if (!isServerAdmin && !isBotAdmin) {
      await interaction.reply({
        content: '❌ **You are not admin for this server**\nPlease contact an admin to manage leaderboard settings.',
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'join') {
      const { isServerOnLeaderboard } = await import('./storage.js');
      const isAlreadyOnLeaderboard = await isServerOnLeaderboard(guildId);

      if (isAlreadyOnLeaderboard) {
        await interaction.reply({
          content: '✅ **Your server is already on the leaderboard!**\nUse `/server_leaderboard leave` to remove it.',
          ephemeral: true
        });
        return;
      }

      // Start the leaderboard setup process
      const setupEmbed = new EmbedBuilder()
        .setTitle('🏆 Join Community Server Leaderboard')
        .setDescription('**Welcome to the SquadForge Community!**\n\nThe server leaderboard allows other Discord users to discover and join community servers through SquadForge.')
        .addFields(
          {
            name: '✨ Benefits',
            value: '• Increased server visibility\n• More potential members\n• Community recognition\n• Activity tracking',
            inline: false
          },
          {
            name: '📋 Requirements',
            value: '• Must be a community server\n• Provide accurate content ratings\n• Allow public invites\n• Follow Discord\'s Terms of Service',
            inline: false
          },
          {
            name: '🔒 Privacy',
            value: 'Only public information and statistics will be shown. Your server settings remain private.',
            inline: false
          }
        )
        .setColor(0x00ff00)
        .setFooter({ text: 'Continue to start the setup process' });

      const continueButton = new ButtonBuilder()
        .setCustomId('leaderboard_setup_start')
        .setLabel('Continue Setup')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀');

      const cancelButton = new ButtonBuilder()
        .setCustomId('leaderboard_setup_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const setupRow = new ActionRowBuilder().addComponents(continueButton, cancelButton);

      await interaction.reply({
        embeds: [setupEmbed],
        components: [setupRow],
        ephemeral: true
      });

    } else if (subcommand === 'leave') {
      const { isServerOnLeaderboard, removeServerFromLeaderboard } = await import('./storage.js');
      const isOnLeaderboard = await isServerOnLeaderboard(guildId);

      if (!isOnLeaderboard) {
        await interaction.reply({
          content: '❌ **Your server is not on the leaderboard.**\nUse `/server_leaderboard join` to add it.',
          ephemeral: true
        });
        return;
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Remove Server from Leaderboard')
        .setDescription('**Are you sure you want to remove your server from the community leaderboard?**')
        .addFields(
          {
            name: '📉 What will happen',
            value: '• Your server will no longer be discoverable\n• Leaderboard stats will be hidden\n• Users can\'t join via server browser\n• You can rejoin anytime',
            inline: false
          }
        )
        .setColor(0xff0000)
        .setFooter({ text: 'This action can be reversed anytime' });

      const confirmButton = new ButtonBuilder()
        .setCustomId('leaderboard_leave_confirm')
        .setLabel('Remove from Leaderboard')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const cancelButton = new ButtonBuilder()
        .setCustomId('leaderboard_leave_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const confirmRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        ephemeral: true
      });

    } else if (subcommand === 'status') {
      const { isServerOnLeaderboard, getServerLeaderboard } = await import('./storage.js');
      const isOnLeaderboard = await isServerOnLeaderboard(guildId);

      if (!isOnLeaderboard) {
        await interaction.reply({
          content: '📊 **Server Leaderboard Status: Not Listed**\n\nYour server is not currently on the community leaderboard.\nUse `/server_leaderboard join` to add it and increase your server\'s visibility!',
          ephemeral: true
        });
        return;
      }

      const leaderboard = await getServerLeaderboard();
      const serverEntry = leaderboard.find(entry => entry.guildId === guildId);

      if (!serverEntry) {
        await interaction.reply({
          content: '❌ **Error retrieving server information.**\nPlease try again later.',
          ephemeral: true
        });
        return;
      }

      const position = leaderboard.findIndex(entry => entry.guildId === guildId) + 1;
      const contentSettingsText = Object.entries(serverEntry.contentSettings)
        .map(([key, value]) => `• **${key}:** ${value ? 'Yes' : 'No'}`)
        .join('\n') || 'No restrictions set';

      const statusEmbed = new EmbedBuilder()
        .setTitle('🏆 Server Leaderboard Status')
        .setDescription(`**${serverEntry.serverName}** is currently listed on the community leaderboard!`)
        .addFields(
          {
            name: '📊 Leaderboard Position',
            value: `**#${position}** out of ${leaderboard.length} servers`,
            inline: true
          },
          {
            name: '👥 Member Count',
            value: `${serverEntry.memberCount.toLocaleString()}`,
            inline: true
          },
          {
            name: '🎮 Total Queues',
            value: `${serverEntry.totalQueues.toLocaleString()}`,
            inline: true
          },
          {
            name: '📈 Recent Activity',
            value: `${serverEntry.recentQueueCount} queues this week`,
            inline: true
          },
          {
            name: '🔞 Age Rating',
            value: serverEntry.ageRating,
            inline: true
          },
          {
            name: '⭐ Status',
            value: serverEntry.featured ? 'Featured' : 'Active',
            inline: true
          },
          {
            name: '📋 Content Settings',
            value: contentSettingsText,
            inline: false
          }
        )
        .setColor(0x00ff00)
        .setFooter({ text: `Listed since ${new Date(serverEntry.createdAt).toLocaleDateString()}` })
        .setTimestamp();

      await interaction.reply({
        embeds: [statusEmbed],
        ephemeral: true
      });
    }
  }
};

export const serverBrowserCommand = {
  data: new SlashCommandBuilder()
    .setName('server_browser')
    .setDescription('Browse and discover community servers'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const { getServerLeaderboard } = await import('./storage.js');
      let servers = await getServerLeaderboard();
      let ageRatingFilter = null;
      let nsfwFilter = null;

      // Apply filters
      if (ageRatingFilter) {
        servers = servers.filter(server => server.ageRating === ageRatingFilter);
      }

      if (nsfwFilter !== null) {
        servers = servers.filter(server => {
          const allowsNSFW = server.contentSettings['NSFW Content'] === true;
          return nsfwFilter ? allowsNSFW : !allowsNSFW;
        });
      }

      if (servers.length === 0) {
        const noResultsEmbed = new EmbedBuilder()
          .setTitle('🔍 No Servers Found')
          .setDescription('**No servers match your current filters.**')
          .addFields(
            {
              name: '💡 Try These Tips',
              value: '• Remove or change your age rating filter\n• Adjust your content preferences\n• Check back later for new servers',
              inline: false
            },
            {
              name: '🌟 Want to add your server?',
              value: 'Use `/server_leaderboard join` to add your server to the community!',
              inline: false
            }
          )
          .setColor(0xff6b6b)
          .setFooter({ text: 'SquadForge Community Browser' })
          .setTimestamp();

        await interaction.editReply({
          embeds: [noResultsEmbed]
        });
        return;
      }

      // Create pages of servers (10 per page for compact display)
      const serversPerPage = 10;
      let totalPages = Math.ceil(servers.length / serversPerPage);
      let currentPage = 0;

      const getActivityEmoji = (queueCount) => {
        if (queueCount >= 50) return '🔥';
        if (queueCount >= 20) return '⚡';
        if (queueCount >= 5) return '🔺';
        return '🔻';
      };

      const getRankEmoji = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        if (rank <= 10) return '🏆';
        return '🎯';
      };

      const generateEmbed = (page) => {
        const startIndex = page * serversPerPage;
        const endIndex = Math.min(startIndex + serversPerPage, servers.length);
        const pageServers = servers.slice(startIndex, endIndex);

        const activeFilters = [];
        if (ageRatingFilter) activeFilters.push(`Age: ${ageRatingFilter}`);
        if (nsfwFilter !== null) activeFilters.push(`NSFW: ${nsfwFilter ? 'Allowed' : 'Not allowed'}`);

        const embed = new EmbedBuilder()
          .setTitle('🌐 SquadForge Community Browser')
          .setDescription(`**Discover amazing gaming communities!**\n${activeFilters.length > 0 ? `**Filters:** ${activeFilters.join(' • ')}\n` : ''}Showing ${startIndex + 1}-${endIndex} of ${servers.length} servers`)
          .setColor(0x4f46e5)
          .setFooter({ text: `Page ${page + 1} of ${totalPages} • SquadForge Community` })
          .setTimestamp();

        // Format content tags concisely
        const getContentTag = (server) => {
          if (server.contentSettings['Clean Content Only']) return 'Family-friendly';
          if (server.contentSettings['NSFW Content']) return '🔞NSFW content allowed';
          if (server.contentSettings['Mature Themes']) return '⚠️Mature';
          return 'Family-friendly';
        };

        // Create individual server entries with separation
        for (let i = 0; i < pageServers.length; i++) {
          const server = pageServers[i];
          const globalRank = startIndex + i + 1;
          const rankEmoji = getRankEmoji(globalRank);
          const activityEmoji = getActivityEmoji(server.filledQueuesThisWeek || 0);
          const contentTag = getContentTag(server);
          const mostQueuedGame = server.mostQueuedGameThisWeek || 'No activity';

          let fieldValue = `${rankEmoji} **#${globalRank} [${server.serverName}](https://discord.gg/${server.inviteCode})** ${server.featured ? '⭐' : ''}\n` +
                          `• Members ${server.memberCount.toLocaleString()} • ${contentTag} ${server.ageRating} • ${activityEmoji} ${server.filledQueuesThisWeek || 0} queues filled this week` +
                          ` • Most queued: **${mostQueuedGame}**`;

          // Add separation line between servers (except for the last one)
          if (i < pageServers.length - 1) {
            fieldValue += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
          }

          embed.addFields({
            name: i === 0 ? '🎮 Gaming Servers' : '\u200B',
            value: fieldValue,
            inline: false
          });
        }

        // Add helpful footer information only on first page and only if there's space
        if (page === 0 && pageServers.length <= 8) {
          embed.addFields({
            name: '❗️Warning',
            value: 'Server admin input is used for age rating. Please use user discretion when looking at age ratings!',
            inline: false
          });
        }

        return embed;
      };

      const generateButtons = (page) => {
        const prevButton = new ButtonBuilder()
          .setCustomId('server_browser_prev')
          .setLabel('<-')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);

        const refreshButton = new ButtonBuilder()
          .setCustomId('server_browser_refresh')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary);

        const nextButton = new ButtonBuilder()
          .setCustomId('server_browser_next')
          .setLabel('->')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1);

        const homeButton = new ButtonBuilder()
          .setCustomId('server_browser_home')
          .setLabel('Home')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page === 0);

        return new ActionRowBuilder().addComponents(prevButton, homeButton, nextButton, refreshButton);
      };

      const generateFilters = () => {
        const filterSelect = new StringSelectMenuBuilder()
          .setCustomId('server_browser_filter')
          .setPlaceholder('🔍 Apply filters... (select multiple)')
          .setMinValues(1)
          .setMaxValues(7)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Clear All Filters')
              .setValue('all')
              .setDescription('Remove all filters and show all servers')
              .setEmoji('🌐'),
            new StringSelectMenuOptionBuilder()
              .setLabel('13+ Only')
              .setValue('age_13')
              .setDescription('Show only 13+ rated servers')
              .setEmoji('👶'),
            new StringSelectMenuOptionBuilder()
              .setLabel('16+ Only')
              .setValue('age_16')
              .setDescription('Show only 16+ rated servers')
              .setEmoji('🧒'),
            new StringSelectMenuOptionBuilder()
              .setLabel('18+ Only')
              .setValue('age_18')
              .setDescription('Show only 18+ rated servers')
              .setEmoji('🔞'),
            new StringSelectMenuOptionBuilder()
              .setLabel('NSFW Allowed')
              .setValue('nsfw_yes')
              .setDescription('Show servers that allow NSFW content')
              .setEmoji('🔞'),
            new StringSelectMenuOptionBuilder()
              .setLabel('NSFW Not Allowed')
              .setValue('nsfw_no')
              .setDescription('Show servers that don\'t allow NSFW content')
              .setEmoji('✨'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Family-Friendly Only')
              .setValue('family_friendly')
              .setDescription('Show only clean content servers')
              .setEmoji('👨‍👩‍👧‍👦')
          );

        return new ActionRowBuilder().addComponents(filterSelect)
      };

      const message = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: [generateFilters(), generateButtons(currentPage)]
      });

      if (totalPages > 1) {
        const collector = message.createMessageComponentCollector({
          time: 600000 // 10 minutes (extended for better UX)
        });

        collector.on('collect', async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({
              content: '❌ Only the user who ran this command can navigate the browser.',
              ephemeral: true
            });
            return;
          }

          // Ignore the disabled page info button
          if (i.customId === 'server_browser_page_info') {
            await i.deferUpdate();
            return;
          }

          if (i.customId === 'server_browser_filter') {
            try {
              const filterValues = i.values;

              // Reset filters
              ageRatingFilter = null;
              nsfwFilter = null;
              let familyFriendlyFilter = false;

              // Check if "Clear All Filters" is selected
              if (filterValues.includes('all')) {
                // Clear all filters
                ageRatingFilter = null;
                nsfwFilter = null;
                familyFriendlyFilter = false;
              } else {
                // Apply selected filters
                filterValues.forEach(filterValue => {
                  switch (filterValue) {
                    case 'age_13':
                      ageRatingFilter = '13+';
                      break;
                    case 'age_16':
                      ageRatingFilter = '16+';
                      break;
                    case 'age_18':
                      ageRatingFilter = '18+';
                      break;
                    case 'nsfw_yes':
                      nsfwFilter = true;
                      break;
                    case 'nsfw_no':
                      nsfwFilter = false;
                      break;
                    case 'family_friendly':
                      familyFriendlyFilter = true;
                      break;
                  }
                });
              }

              // Refresh server list with new filters
              const refreshedServers = await getServerLeaderboard();

              // Apply new filters
              let filteredServers = refreshedServers;

              if (ageRatingFilter) {
                filteredServers = filteredServers.filter(server => server.ageRating === ageRatingFilter);
              }

              if (nsfwFilter !== null) {
                filteredServers = filteredServers.filter(server => {
                  const allowsNSFW = server.contentSettings['NSFW Content'] === true;
                  return nsfwFilter ? allowsNSFW : !allowsNSFW;
                });
              }

              if (familyFriendlyFilter) {
                filteredServers = filteredServers.filter(server => 
                  server.contentSettings['Clean Content Only'] === true
                );
              }

              // Update servers and pagination
              servers = filteredServers;
              const newTotalPages = Math.ceil(servers.length / serversPerPage);
              totalPages = newTotalPages;
              currentPage = 0; // Reset to first page when applying filters

              await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateFilters(), generateButtons(currentPage)]
              });
              return;
            } catch (error) {
              console.error('Error applying filter:', error);
              await i.reply({
                content: '❌ **Error applying filter**\nPlease try again later.',
                ephemeral: true
              });
              return;
            }
          }

          if (i.customId === 'server_browser_refresh') {
            try {
              await i.deferUpdate();

              // Refresh the server list
              const refreshedServers = await getServerLeaderboard();

              // Re-apply current filters
              let filteredServers = refreshedServers;
              if (ageRatingFilter) {
                filteredServers = filteredServers.filter(server => server.ageRating === ageRatingFilter);
              }
              if (nsfwFilter !== null) {
                filteredServers = filteredServers.filter(server => {
                  const allowsNSFW = server.contentSettings['NSFW Content'] === true;
                  return nsfwFilter ? allowsNSFW : !allowsNSFW;
                });
              }

              // Update servers and totalPages with new data
              servers = filteredServers;
              const newTotalPages = Math.ceil(servers.length / serversPerPage);
              totalPages = newTotalPages;

              // Reset to first page if current page is out of bounds or if no servers
              if (currentPage >= totalPages || servers.length === 0) {
                currentPage = Math.max(0, totalPages - 1);
              }

              await i.editReply({
                embeds: [generateEmbed(currentPage)],
                components: [generateFilters(), generateButtons(currentPage)]
              });
              return;
            } catch (error) {
              console.error('Error refreshing server browser:', error);
              try {
                await i.editReply({
                  content: '❌ **Error refreshing server list**\nPlease try again later.',
                  embeds: [generateEmbed(currentPage)],
                  components: [generateFilters(), generateButtons(currentPage)]
                });
              } catch (updateError) {
                console.error('Error updating interaction after refresh error:', updateError);
              }
              return;
            }
          }

          if (i.customId === 'server_browser_prev') {
            currentPage = Math.max(0, currentPage - 1);
          } else if (i.customId === 'server_browser_next') {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
          } else if (i.customId === 'server_browser_home') {
            currentPage = 0;
          }

          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [generateFilters(), generateButtons(currentPage)]
          });
        });

        collector.on('end', async () => {
          try {
            const buttonRow = generateButtons(currentPage);
            const disabledButtons = buttonRow.components.map(button => 
              ButtonBuilder.from(button).setDisabled(true)
            );
            const disabledRow = new ActionRowBuilder().addComponents(...disabledButtons);

            const disabledFilters = generateFilters().components.map(component => 
              StringSelectMenuBuilder.from(component).setDisabled(true)
            );
            const disabledFilterRow = new ActionRowBuilder().addComponents(...disabledFilters);

            await message.edit({
              components: [disabledFilterRow, disabledRow]
            });
          } catch (error) {
            // Message might be deleted, ignore error
          }
        });
      }

    } catch (error) {
      console.error('Error in server browser command:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Browser Error')
        .setDescription('**Unable to load the server browser at this time.**')
        .addFields({
          name: '🔧 What you can try',
          value: '• Wait a moment and try again\n• Check your internet connection\n• Contact support if the issue persists',
          inline: false
        })
        .setColor(0xff4757)
        .setFooter({ text: 'SquadForge Support' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [errorEmbed]
      });
    }
  }
};

export const devSendNewsCommand = {
  data: new SlashCommandBuilder()
    .setName('dev_send_news')
    .setDescription('[DEV ONLY] Send news to all configured servers')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('News title')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption(option =>
      option.setName('content')
        .setDescription('News content')
        .setRequired(true)
        .setMaxLength(4000)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of news')
        .setRequired(false)
        .addChoices(
          { name: 'Update', value: 'update' },
          { name: 'Announcement', value: 'announcement' },
          { name: 'Maintenance', value: 'maintenance' },
          { name: 'Feature', value: 'feature' }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const DEV_USER_ID = '1308923783138250883';

    // Check if user is the developer
    if (userId !== DEV_USER_ID) {
      await interaction.reply({
        content: '❌ **Access Denied**\nThis command is restricted to the bot developer only.',
        ephemeral: true
      });
      return;
    }

    const title = interaction.options.getString('title');
    const content = interaction.options.getString('content');
    const newsType = interaction.options.getString('type') || 'announcement';

    await interaction.deferReply({ ephemeral: true });

    try {
      const { getAllNewsChannels } = await import('./storage.js');
      const newsChannels = await getAllNewsChannels();

      if (newsChannels.length === 0) {
        await interaction.editReply({
          content: '📰 **No news channels configured**\nNo servers have set up news channels yet.'
        });
        return;
      }

      // Create news embed
      const newsTypeEmojis = {
        update: '🔄',
        announcement: '📢',
        maintenance: '🔧',
        feature: '✨'
      };

      const newsTypeColors = {
        update: 0x0099ff,
        announcement: 0x00ff00,
        maintenance: 0xff9900,
        feature: 0x9932cc
      };

      const newsEmbed = new EmbedBuilder()
        .setTitle(`${newsTypeEmojis[newsType]} ${title}`)
        .setDescription(content)
        .setColor(newsTypeColors[newsType])
        .setTimestamp()
        .setFooter({ 
          text: 'SquadForge Bot News', 
          iconURL: interaction.client.user.displayAvatarURL() 
        });

      let successCount = 0;
      let failCount = 0;

      // Send news to all configured channels
      for (const channelData of newsChannels) {
        try {
          const guild = interaction.client.guilds.cache.get(channelData.guild_id);
          if (!guild) {
            failCount++;
            continue;
          }

          const channel = guild.channels.cache.get(channelData.news_channel_id);
          if (!channel) {
            failCount++;
            continue;
          }

          await channel.send({ embeds: [newsEmbed] });
          successCount++;
        } catch (error) {
          console.error(`Error sending news to guild ${channelData.guild_id}:`, error);
          failCount++;
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle('📰 News Broadcast Complete!')
        .setDescription(`**"${title}"** has been sent to all configured news channels`)
        .addFields(
          {
            name: '📊 Broadcast Results',
            value: `✅ **Successful:** ${successCount} servers\n❌ **Failed:** ${failCount} servers\n📺 **Total Channels:** ${newsChannels.length}`,
            inline: false
          },
          {
            name: '📝 News Details',
            value: `**Type:** ${newsType.charAt(0).toUpperCase() + newsType.slice(1)}\n**Title:** ${title}\n**Content Length:** ${content.length} characters`,
            inline: false
          }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({
        embeds: [resultEmbed]
      });

    } catch (error) {
      console.error('Error broadcasting news:', error);
      await interaction.editReply({
        content: '❌ **Error broadcasting news**\nAn error occurred while sending the news. Please check the logs for details.'
      });
    }
  }
};

// Joke history tracking
const lastJokes = [];
const maxHistory = 5;

export const jokeCommand = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Tells a random family-friendly joke!')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('joke')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    const jokes = [
      "Why did the gamer bring a broom? ||Because he was sweeping the leaderboard.||",
      "I told my computer I needed a break, and it said: ||'I'll crash for you.'||",
      "Why don't skeletons fight each other? ||They don't have the guts.||",
      "What do you call fake spaghetti? ||An impasta.||",
      "How do you organize a space party? ||You planet.||",
      "Why did the scarecrow win an award? ||Because he was outstanding in his field.||",
      "Parallel lines have so much in common. ||It's a shame they'll never meet.||",
      "Why was the computer cold? ||It left its Windows open.||",
      "Why do programmers hate nature? ||Too many bugs.||",
      "How do you make a tissue dance? ||Put a little boogie in it.||",
      "||Your mom!||",
      "Have you heard the joke about yoga? ||Nevermind it's a bit of a stretch.||",
      "What do you call a nose with no body? ||No body nose.||",
      "I couldn't figure out why the baseball kept getting larger. ||Then it hit me.||",
      "Why can you never trust an atom? ||Because they make up everything.||",
      "How much room is needed for fungi to grow? ||As mushroom as possible.||",
      "Where do cows go on Friday night? ||To the MOOOOOvies.||",
      "What did one wall say to the other wall? ||I'll meet you at the corner.||",
      "Why don't eggs tell jokes? ||They'd crack each other up.||",
      "What did the left eye say to the right eye? ||Between you and me, something smells.||",
      "Why don't oysters donate to charity? ||Because they're shellfish.||",
      "How do cows stay up to date? ||They read the moos-paper.||",
      "Why did the bicycle fall over? ||It was two-tired.||",
      "What kind of music do mummies listen to? ||Wrap music.||",
      "What do you call cheese that isn't yours? ||Nacho cheese.||",
      "Why did the cookie go to the doctor? ||Because it was feeling crummy.||",
      "What's orange and sounds like a parrot? ||A carrot.||",
      "Why did the golfer bring two pairs of pants? ||In case he got a hole in one.||",
      "What do you call a bear with no teeth? ||A gummy bear.||",
      "Why don't elephants use computers? ||They're afraid of the mouse.||",
      "What do you get when you cross a snowman and a dog? ||Frostbite.||",
      "What do cats like to read? ||Catalogs.||",
      "How does a penguin build its house? ||Igloos it together.||",
      "What's a computer's favorite snack? ||Microchips.||",
      "Why was the keyboard stressed out? ||It had too many shifts.||",
      "your mom is so fat she doesn't need the internet ||because she's already worldwide.||",
      "why don't fish like listening to music ||because its too Catchy"
    ];

    let randomIndex;
    const maxAttempts = 10;
    let attempts = 0;

    do {
      randomIndex = Math.floor(Math.random() * jokes.length);
      attempts++;
    } while (
      lastJokes.includes(randomIndex) &&
      attempts < maxAttempts &&
      jokes.length > maxHistory
    );

    // Update history
    lastJokes.push(randomIndex);
    if (lastJokes.length > maxHistory) lastJokes.shift(); // Keep only last N

    const randomJoke = jokes[randomIndex];

    await interaction.reply({
      embeds: [
        {
          title: "😂 Here's a joke for you!",
          description: randomJoke,
          color: 0x00AE86
        }
      ]
    });
  }
};