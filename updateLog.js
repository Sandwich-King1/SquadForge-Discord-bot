
import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

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
