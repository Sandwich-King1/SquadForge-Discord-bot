
import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } from 'discord.js';

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
      const { saveNewsChannel } = await import('../storage.js');
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
