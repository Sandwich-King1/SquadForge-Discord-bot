
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const serverLeaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('server_leaderboard')
    .setDescription('View the server leaderboard for queue activity'),

  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🏆 Server Leaderboard')
        .setDescription('Leaderboard feature coming soon!')
        .setColor(0x0099ff)
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in server leaderboard command:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching the leaderboard.',
        ephemeral: true
      });
    }
  }
};
