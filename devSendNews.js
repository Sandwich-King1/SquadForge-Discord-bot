
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

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
      const { getAllNewsChannels } = await import('../storage.js');
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
