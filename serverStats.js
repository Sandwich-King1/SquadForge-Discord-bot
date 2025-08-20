
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isModerator } from '../isBotAdmin.js';

export const serverStatsCommand = {
  data: new SlashCommandBuilder()
    .setName('server_stats')
    .setDescription('View server statistics and queue activity'),

  async execute(interaction) {
    if (!isModerator(interaction)) {
      await interaction.reply({
        content: '❌ You need moderator permissions to use this command.',
        ephemeral: true
      });
      return;
    }

    try {
      const { activeQueues } = await import('../interactions.js');
      const guildId = interaction.guildId;
      
      // Count server queues
      const serverQueues = Array.from(activeQueues.values()).filter(queue => queue.guildId === guildId);
      const totalPlayers = serverQueues.reduce((sum, queue) => sum + (queue.players?.length || 0), 0);
      
      const statsEmbed = new EmbedBuilder()
        .setTitle(`📊 Server Statistics - ${interaction.guild.name}`)
        .addFields(
          { name: 'Active Queues', value: serverQueues.length.toString(), inline: true },
          { name: 'Total Players in Queues', value: totalPlayers.toString(), inline: true },
          { name: 'Server Members', value: interaction.guild.memberCount.toString(), inline: true }
        )
        .setColor(0x0099ff)
        .setTimestamp();

      await interaction.reply({
        embeds: [statsEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in server stats command:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching server statistics.',
        ephemeral: true
      });
    }
  }
};
