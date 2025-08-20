
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const leaveAllQueuesCommand = {
  data: new SlashCommandBuilder()
    .setName('leave_all_queues')
    .setDescription('Leave all queues you are currently in'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      
      // Import the activeQueues from interactions.js
      const { activeQueues } = await import('../interactions.js');
      
      let leftQueues = [];
      let closedQueues = [];
      let errors = [];

      // Find all queues the user is in
      for (const [queueId, queue] of activeQueues) {
        if (queue.guildId === guildId && queue.players && queue.players.includes(userId)) {
          try {
            // Remove user from queue
            queue.players = queue.players.filter(id => id !== userId);
            
            // If user was the owner and queue becomes empty, close it
            if (queue.ownerId === userId || queue.players.length === 0) {
              activeQueues.delete(queueId);
              closedQueues.push(queue.gameName || 'Unknown Game');
            } else {
              leftQueues.push(queue.gameName || 'Unknown Game');
            }
          } catch (error) {
            errors.push(`Failed to leave queue: ${queue.gameName || 'Unknown Game'}`);
          }
        }
      }

      // Create response embed
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Queue Operations Complete')
        .setColor(0x00ff00)
        .setTimestamp();

      let description = '';
      let fields = [];

      if (leftQueues.length === 0 && closedQueues.length === 0) {
        successEmbed.setDescription('You are not currently in any queues.');
        successEmbed.setColor(0xffff00); // Yellow for no action
      } else {
        if (leftQueues.length > 0) {
          fields.push({
            name: '🚪 Left Queues',
            value: leftQueues.map(name => `• ${name}`).join('\n'),
            inline: false
          });
          if (description) description += ' and ';
          description += `left ${leftQueues.length} queue${leftQueues.length > 1 ? 's' : ''}`;
        }

        if (closedQueues.length > 0) {
          fields.push({
            name: '🔒 Closed Queues',
            value: closedQueues.map(name => `• ${name}`).join('\n'),
            inline: false
          });
          if (description) description += ' and ';
          description += `closed ${closedQueues.length} queue${closedQueues.length > 1 ? 's' : ''}`;
        }

        if (errors.length > 0) {
          fields.push({
            name: '❌ Errors',
            value: errors.map(error => `• ${error}`).join('\n'),
            inline: false
          });
          successEmbed.setColor(0xff9900); // Orange for partial success
        }

        successEmbed.setDescription(description);
        if (fields.length > 0) {
          successEmbed.addFields(...fields);
        }
      }

      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in leave all queues command:', error);
      await interaction.reply({
        content: '❌ An error occurred while trying to leave queues.',
        ephemeral: true
      });
    }
  }
};
