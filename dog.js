
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export const dogCommand = {
  data: new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Sends a random dog picture!')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('dog')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    await interaction.deferReply();

    try {
      const response = await fetch('https://api.thedogapi.com/v1/images/search?limit=1&api_key=live_lhZTppp1zQjiSAFRipReigbwgpfvLvhrKL012M8VthmYl2NCKfpmAYgjdyZvnmSu');
      const data = await response.json();
      const dog = data[0];
      const dogImageUrl = dog?.url;
      const breed = dog.breeds?.[0];

      if (!dogImageUrl) {
        return interaction.editReply('🐶 Could not fetch a dog picture right now. Try again later.');
      }

      const dogTitles = ["Here\'s a cute dog!", "Here\'s a lovely dog photo!", "Here\'s a dog!", "Here\'s a dog photo!", "Here\'s a dog photo... well I think so.", "Here\'s a splendid dog", "Here\'s a beautiful dog!", "Cute dog isn\'t it?"]
      const RandomDogTitle = dogTitles[Math.floor(Math.random() * dogTitles.length)
        ];
      const embed = new EmbedBuilder()
        .setTitle('🐶'+ RandomDogTitle)
        .setImage(dogImageUrl)
        .setColor(0xff9900);

      // Only add the button if breed info exists
      if (breed) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('show_info')
            .setLabel('📖 Show Info')
            .setStyle(ButtonStyle.Primary)
        );

        const message = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15_000,
          max: 1,
          filter: i => i.user.id === interaction.user.id,
        });

        collector.on('collect', async i => {
          if (i.customId === 'show_info') {
            embed.setTitle(`🐶 ${breed.name}`)
              .setDescription(breed.description || 'No description available.')
              .addFields(
                { name: 'Origin', value: breed.origin || 'Unknown', inline: true },
                { name: 'Temperament', value: breed.temperament || 'Unknown', inline: true }
              );
            await i.update({ embeds: [embed], components: [] }); // remove button
          }
        });

        collector.on('end', async collected => {
          if (collected.size === 0) {
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('show_info')
                .setLabel('📖 Show Info')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );
            await message.edit({ components: [disabledRow] });
          }
        });

      } else {
        // No breed info – just send the image
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error('Dog API error:', err);
      await interaction.editReply('❌ Failed to fetch dog. The API might be down.');
    }
  }
};
