
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { removeQueueSearch } from '../storage.js';

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
