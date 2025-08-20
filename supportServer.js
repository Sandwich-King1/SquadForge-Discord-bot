
import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export const supportServerCommand = {
    data: new SlashCommandBuilder()
        .setName('support_server')
        .setDescription('Join the official SquadForge server')
        .setDMPermission(true)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

        async execute(interaction) {
            const supportServerInvite = ['https://discord.gg/rquG7Nu5'];
            await interaction .reply({
                content: `Join the official SquadForge server to get support and stay updated!\n${supportServerInvite}`,
                ephemeral: true
            })
        },
};
