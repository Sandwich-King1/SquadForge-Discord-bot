
import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

// Joke history tracking
const lastJokes = [];
const maxHistory = 5;

export const jokeCommand = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Tells a random family-friendly joke!')
    .setDMPermission(true)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

  async execute(interaction) {
    // Check if fun commands are disabled for this guild
    const guildId = interaction.guildId;
    if (guildId && global.disabledFunCommands?.[guildId]?.has('joke')) {
      await interaction.reply({
        content: '❌ **Fun commands are disabled in this server.**\nContact a server admin to enable them.',
        ephemeral: true
      });
      return;
    }
    const jokes = [
      "Why did the gamer bring a broom? ||Because he was sweeping the leaderboard.||",
      "I told my computer I needed a break, and it said: ||'I'll crash for you.'||",
      "Why don't skeletons fight each other? ||They don't have the guts.||",
      "What do you call fake spaghetti? ||An impasta.||",
      "How do you organize a space party? ||You planet.||",
      "Why did the scarecrow win an award? ||Because he was outstanding in his field.||",
      "Parallel lines have so much in common. ||It's a shame they'll never meet.||",
      "Why was the computer cold? ||It left its Windows open.||",
      "Why do programmers hate nature? ||Too many bugs.||",
      "How do you make a tissue dance? ||Put a little boogie in it.||",
      "||Your mom!||",
      "Have you heard the joke about yoga? ||Nevermind it's a bit of a stretch.||",
      "What do you call a nose with no body? ||No body nose.||",
      "I couldn't figure out why the baseball kept getting larger. ||Then it hit me.||",
      "Why can you never trust an atom? ||Because they make up everything.||",
      "How much room is needed for fungi to grow? ||As mushroom as possible.||",
      "Where do cows go on Friday night? ||To the MOOOOOvies.||",
      "What did one wall say to the other wall? ||I'll meet you at the corner.||",
      "Why don't eggs tell jokes? ||They'd crack each other up.||",
      "What did the left eye say to the right eye? ||Between you and me, something smells.||",
      "Why don't oysters donate to charity? ||Because they're shellfish.||",
      "How do cows stay up to date? ||They read the moos-paper.||",
      "Why did the bicycle fall over? ||It was two-tired.||",
      "What kind of music do mummies listen to? ||Wrap music.||",
      "What do you call cheese that isn't yours? ||Nacho cheese.||",
      "Why did the cookie go to the doctor? ||Because it was feeling crummy.||",
      "What's orange and sounds like a parrot? ||A carrot.||",
      "Why did the golfer bring two pairs of pants? ||In case he got a hole in one.||",
      "What do you call a bear with no teeth? ||A gummy bear.||",
      "Why don't elephants use computers? ||They're afraid of the mouse.||",
      "What do you get when you cross a snowman and a dog? ||Frostbite.||",
      "What do cats like to read? ||Catalogs.||",
      "How does a penguin build its house? ||Igloos it together.||",
      "What's a computer's favorite snack? ||Microchips.||",
      "Why was the keyboard stressed out? ||It had too many shifts.||",
      "your mom is so fat she doesn't need the internet ||because she's already worldwide.||",
      "why don't fish like listening to music ||because its too Catchy"
    ];

    let randomIndex;
    const maxAttempts = 10;
    let attempts = 0;

    do {
      randomIndex = Math.floor(Math.random() * jokes.length);
      attempts++;
    } while (
      lastJokes.includes(randomIndex) &&
      attempts < maxAttempts &&
      jokes.length > maxHistory
    );

    // Update history
    lastJokes.push(randomIndex);
    if (lastJokes.length > maxHistory) lastJokes.shift(); // Keep only last N

    const randomJoke = jokes[randomIndex];

    await interaction.reply({
      embeds: [
        {
          title: "😂 Here's a joke for you!",
          description: randomJoke,
          color: 0x00AE86
        }
      ]
    });
  }
};
