
// Tips that will be displayed on queue embeds and queue creation messages
export const tips = [
    "-# Use clear communication with your teammates for better coordination!",
    "-# Consider adding a queue description to attract the right players!",
    "-# Game roles help organize team composition - ask the queue owner to set them up!",
    "-# Join voice chat before the game starts to build better team chemistry!",
    "-# Be specific about your playstyle in custom queues to find compatible teammates!",
    "-# Check the queue's availability time - some queues expire faster than others!",
    "-# Be friendly and patient - good teammates make better games!",
    "-# Use game presets for faster queue creation with popular games!",
    "-# Queue owners can assign specific roles to players for better team balance!",
    "-# Use **/queue_search** to get notified when someone creates a queue for your game!",
    "-# Consistent communication is key to winning - call out important information!",
    "-# Customize your queue with a description to let others know what you're looking for!",
    "-# Queue owners have special controls - they can manage roles and close queues!",
    "-# Be respectful to all players regardless of skill level!",
    "-# Different queue systems work better for different server sizes!",
    "-# Consider your teammates' time zones when setting availability hours!",
    "-# Turn on notifications to quickly join queues when they're created!",
    "-# Practice makes perfect - don't be afraid to try new strategies!",
    "-# Good sportsmanship creates a better gaming environment for everyone!",
    "-# Queue roles are either required or optional for the entire queue - check before joining!",
    "-# Queue owners can use the queue owner menu button to manage more features for their queue!",
    "-# Be aware that queue owners can kick misbehaving players from their queue!"
];

// Function to get a random tip
export function getRandomTip() {
    return tips[Math.floor(Math.random() * tips.length)];
}
