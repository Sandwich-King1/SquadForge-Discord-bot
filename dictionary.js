
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export const dictionaryCommand = {
  data: new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Look up the meaning of a word')
    .addStringOption(option =>
      option.setName('word')
        .setDescription('The word to define')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('ephemeral')
        .setDescription('Only you can see the result (default: false)')
        .setRequired(false)
    )
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('dictionary')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    const query = interaction.options.getString('word').toLowerCase().trim();
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    const words = query.split(/\s+/);

    // Word limit
    if (words.length > 5) {
      await interaction.reply({
        content: '❌ You can only search up to **5 words** at a time.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral });

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${query}`);
      const data = await response.json();

      if (!Array.isArray(data) || !data[0]?.meanings?.length) {
        await interaction.editReply({
          content: `❌ No definitions found for **${query}**.`,
        });
        return;
      }

      const wordData = data[0];
      const word = wordData.word;
      const phonetic = wordData.phonetic || '';
      const meanings = wordData.meanings;

      const makeEmbedForMeaning = (meaning) => {
        const embed = new EmbedBuilder()
          .setTitle(`📖 ${word} (${meaning.partOfSpeech})`)
          .setDescription(phonetic ? `*Phonetic:* \`${phonetic}\`` : null)
          .setColor(0x4b91f1)
          .setTimestamp();

        const defs = meaning.definitions.slice(0, 3);
        defs.forEach((def, index) => {
          embed.addFields({
            name: `Definition ${index + 1}`,
            value: def.definition
          });
          if (def.example) {
            embed.addFields({
              name: '💬 Example',
              value: def.example
            });
          }
        });

        if (defs[0].synonyms?.length) {
          embed.addFields({
            name: '🔁 Synonyms',
            value: defs[0].synonyms.slice(0, 5).join(', ')
          });
        }

        if (defs[0].antonyms?.length) {
          embed.addFields({
            name: '↔️ Antonyms',
            value: defs[0].antonyms.slice(0, 5).join(', ')
          });
        }

        return embed;
      };

      const defaultMeaning = meanings[0];
      const embed = makeEmbedForMeaning(defaultMeaning);

      const options = meanings.map((m, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.partOfSpeech)
          .setValue(String(i))
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_pos_${query}_${interaction.id}`)
        .setPlaceholder('Choose word form')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const msg = await interaction.editReply({
        embeds: [embed],
        components: meanings.length > 1 ? [row] : [],
        fetchReply: true
      });

      if (meanings.length > 1) {
        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        collector.on('collect', async (selectInteraction) => {
          if (selectInteraction.user.id !== interaction.user.id) {
            await selectInteraction.reply({
              content: "❌ You can't interact with this menu.",
              ephemeral: true
            });
            return;
          }

          const selectedIndex = parseInt(selectInteraction.values[0]);
          const selectedMeaning = meanings[selectedIndex];
          const newEmbed = makeEmbedForMeaning(selectedMeaning);

          await selectInteraction.update({ embeds: [newEmbed] });
        });

        collector.on('end', async () => {
          await interaction.editReply({ components: [] }).catch(() => {});
        });
      }

    } catch (err) {
      console.error('Dictionary API Error:', err);
      await interaction.editReply({
        content: '❌ Failed to fetch word data. Try again later.'
      });
    }
  }
};
