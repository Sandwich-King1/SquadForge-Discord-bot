
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { saveQueueSearch } from '../storage.js';

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
          const { removeQueueSearch } = await import('../storage.js');
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
