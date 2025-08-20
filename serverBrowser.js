
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const serverBrowserCommand = {
  data: new SlashCommandBuilder()
    .setName('server_browser')
    .setDescription('Browse active queues across servers'),

  async execute(interaction) {
    try {
      const { activeQueues } = await import('../interactions.js');
      
      // Get all active queues
      const allQueues = Array.from(activeQueues.values());
      
      if (allQueues.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🔍 Server Browser')
          .setDescription('No active queues found across all servers.')
          .setColor(0xffff00);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Group by game
      const gameGroups = {};
      allQueues.forEach(queue => {
        const game = queue.gameName || 'Unknown Game';
        if (!gameGroups[game]) gameGroups[game] = [];
        gameGroups[game].push(queue);
      });

      const embed = new EmbedBuilder()
        .setTitle('🔍 Server Browser')
        .setDescription(`Found ${allQueues.length} active queue${allQueues.length !== 1 ? 's' : ''} across all servers`)
        .setColor(0x0099ff)
        .setTimestamp();

      // Add fields for each game
      Object.entries(gameGroups).slice(0, 10).forEach(([game, queues]) => {
        const queueList = queues.slice(0, 5).map(queue => 
          `• ${queue.players?.length || 0}/${queue.maxPlayers} players`
        ).join('\n');
        
        embed.addFields({
          name: `🎮 ${game} (${queues.length} queue${queues.length !== 1 ? 's' : ''})`,
          value: queueList + (queues.length > 5 ? `\n... and ${queues.length - 5} more` : ''),
          inline: true
        });
      });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in server browser command:', error);
      await interaction.reply({
        content: '❌ An error occurred while browsing servers.',
        ephemeral: true
      });
    }
  }
};
