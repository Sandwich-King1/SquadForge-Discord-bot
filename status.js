
import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

// Helper function
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

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
      const { getQueueStatistics } = await import('../storage.js');
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
