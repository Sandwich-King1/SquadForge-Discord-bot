export function isBotAdmin(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // Server admins are always allowed
  if (interaction.member.permissions.has('Administrator')) return true;

  const admins = global.botAdminsByGuildId?.[guildId];
  return admins?.has(userId) || false;
}

export function isModerator(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // Server admins and bot admins are always moderators
  if (isBotAdmin(interaction)) return true;

  // Check if user has any moderator roles
  const moderatorRoles = global.moderatorRolesByGuildId?.[guildId];
  if (!moderatorRoles || moderatorRoles.size === 0) return false;

  // Check if user has any of the moderator roles
  const userRoles = interaction.member.roles.cache;
  for (const roleId of moderatorRoles) {
    if (userRoles.has(roleId)) return true;
  }

  return false;
}
