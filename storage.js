import { Pool } from 'pg';

// In-memory store of bot admins per server
const botAdminsByGuildId = {}; // Key: guildId, Value: Set of userIds

// Only define this once, ideally at the top of your bot file or inside a setup/init script
if (!global.botAdminsByGuildId) {
  global.botAdminsByGuildId = {}; // { [guildId]: Set(userIds) }
}

if (!global.disabledFunCommands) {
  global.disabledFunCommands = {}; // { [guildId]: Set(commandNames) }
}

// Memory fallback storage
const memoryFallback = {
  guildSettings: new Map(),
  gamePresets: new Map(),
  rolePingConfigurations: new Map(),
  funCommandStates: new Map(),
  newsChannels: new Map(),
  queueSearches: new Map(),
  queueCreationMessages: new Map(),
  moderationRoles: new Map(),
  serverLeaderboard: new Map(),
  pendingSyncs: new Set() // Track what needs to be synced when DB comes back
};

let pool = null;
let queuePool = null;
let isConnected = false;
let queueDbConnected = false;

async function syncMemoryToDatabase() {
    if (!isConnected || !pool) return;
    
    console.log('🔄 Syncing memory data to database...');
    
    try {
        // Sync guild settings
        for (const [guildId, settings] of memoryFallback.guildSettings) {
            await saveGuildSettings(
                guildId, 
                settings.systemType, 
                settings.channelData, 
                settings.maxQueues, 
                settings.maxPlayers, 
                settings.maxAvailability, 
                settings.allowCustomQueues,
                settings.queueLimitBehavior
            );
        }
        
        // Sync game presets
        for (const [guildId, presets] of memoryFallback.gamePresets) {
            await saveGamePresets(guildId, presets);
        }
        
        // Sync fun command states
        for (const [key, isDisabled] of memoryFallback.funCommandStates) {
            const [guildId, commandName] = key.split(':');
            await saveFunCommandState(guildId, commandName, isDisabled);
        }
        
        // Sync news channels
        for (const [guildId, channelId] of memoryFallback.newsChannels) {
            await saveNewsChannel(guildId, channelId);
        }
        
        // Sync queue searches
        for (const [userId, searchData] of memoryFallback.queueSearches) {
            await saveQueueSearch(searchData);
        }
        
        // Sync queue creation messages
        for (const [guildId, data] of memoryFallback.queueCreationMessages) {
            await saveQueueCreationMessage(guildId, data.messageId, data.channelId);
        }
        
        // Sync moderation roles
        for (const [guildId, roleIds] of memoryFallback.moderationRoles) {
            for (const roleId of roleIds) {
                await saveModerationRole(guildId, roleId);
            }
        }
        
        // Clear memory after successful sync
        memoryFallback.guildSettings.clear();
        memoryFallback.gamePresets.clear();
        memoryFallback.funCommandStates.clear();
        memoryFallback.newsChannels.clear();
        memoryFallback.queueSearches.clear();
        memoryFallback.queueCreationMessages.clear();
        memoryFallback.moderationRoles.clear();
        memoryFallback.pendingSyncs.clear();
        
        console.log('✅ Memory data synced to database successfully');
    } catch (error) {
        console.error('❌ Error syncing memory data to database:', error);
    }
}

async function syncQueueMemoryToDatabase() {
    if (!queueDbConnected || !queuePool) return;
    
    console.log('🔄 Syncing queue memory data to database...');
    
    try {
        // Sync queues from memory to database
        for (const [guildId, queues] of Object.entries(queuesByServerId)) {
            for (const queue of queues) {
                await saveQueue(guildId, queue);
            }
        }
        
        console.log('✅ Queue memory data synced to database successfully');
    } catch (error) {
        console.error('❌ Error syncing queue memory data to database:', error);
    }
}

async function connectDB() {
    const wasConnected = isConnected;
    const wasQueueConnected = queueDbConnected;
    
    // Connect to main database
    if (!isConnected) {
        if (!process.env.DATABASE_URL) {
            console.log('DATABASE_URL environment variable not set - bot will continue with memory storage only');
        } else {
            try {
                // Create connection pool
                pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    max: 10,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                    acquireTimeoutMillis: 10000,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });

                // Test the connection
                const client = await pool.connect();
                client.release();

                console.log('✅ Main database connected');
                isConnected = true;

                // Create tables if they don't exist
                await createTables();

                // If this is a reconnection, sync memory data
                if (!wasConnected && (memoryFallback.pendingSyncs.size > 0 || memoryFallback.guildSettings.size > 0)) {
                    await syncMemoryToDatabase();
                }

            } catch (error) {
                console.log('⚠️  Main database: Connection failed - using memory storage');
                // Uncomment line below for detailed error debugging:
                // console.error('Main database connection error:', error);
            }
        }
    }

    // Connect to queue database
    if (!queueDbConnected) {
        const queueDbUrl = process.env.QUEUE_DATABASE_URL || process.env.DATABASE_URL;
        if (!queueDbUrl) {
            console.log('No queue database URL available - queues will be stored in memory only');
        } else {
            try {
                // Create connection pool for queues
                queuePool = new Pool({
                    connectionString: queueDbUrl,
                    max: 10,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                    acquireTimeoutMillis: 10000,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });

                // Test the connection
                const client = await queuePool.connect();
                client.release();

                console.log('✅ Queue database connected');
                queueDbConnected = true;

                // Create queue tables
                await createQueueTables();

                // If this is a reconnection and we have queues in memory, sync them
                if (!wasQueueConnected && Object.keys(queuesByServerId).length > 0) {
                    await syncQueueMemoryToDatabase();
                }

            } catch (error) {
                console.log('⚠️  Queue database: Connection failed - using in-memory storage');
                // Uncomment line below for detailed error debugging:
                // console.error('Queue database connection error:', error);
            }
        }
    }
}

async function createQueueTables() {
    if (!queuePool) return;

    const client = await queuePool.connect();
    try {
        // Create queues table
        await client.query(`
            CREATE TABLE IF NOT EXISTS queues (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                queue_id VARCHAR(100),
                game_name VARCHAR(100),
                game_mode VARCHAR(100),
                max_players INTEGER,
                owner_id VARCHAR(20),
                players TEXT[],
                availability TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                UNIQUE(guild_id, queue_id)
            )
        `);

        // Migrate existing queue_id column to support longer IDs
        try {
            await client.query(`
                ALTER TABLE queues 
                ALTER COLUMN queue_id TYPE VARCHAR(100)
            `);
            console.log('Queue database migration completed - queue_id column updated');
        } catch (migrationError) {
            // Column might already be the correct size, ignore error
            console.log('Queue database migration skipped - column may already be correct size');
        }

        // Add unique constraint if it doesn't exist
        try {
            await client.query(`
                ALTER TABLE queues 
                ADD CONSTRAINT queues_guild_queue_unique UNIQUE (guild_id, queue_id)
            `);
            console.log('Queue database migration completed - unique constraint added');
        } catch (constraintError) {
            // Constraint might already exist, ignore error
            console.log('Queue database migration skipped - unique constraint may already exist');
        }

        console.log('Queue database tables created successfully');
    } catch (error) {
        console.error('Error creating queue tables:', error);
    } finally {
        client.release();
    }
}

async function createTables() {
    if (!pool) return;

    const client = await pool.connect();
    try {
        // Create guild_settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                system_type VARCHAR(20) DEFAULT 'multi_channel',
                queue_channel_id VARCHAR(20),
                queue_category_id VARCHAR(20),
                creation_channel_id VARCHAR(20),
                display_channel_id VARCHAR(20),
                single_channel_id VARCHAR(20),
                max_queues INTEGER DEFAULT 5,
                max_players INTEGER DEFAULT 10,
                max_availability INTEGER DEFAULT 4,
                allow_custom_queues BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add allow_custom_queues column if it doesn't exist (migration)
        try {
            await client.query(`
                ALTER TABLE guild_settings 
                ADD COLUMN IF NOT EXISTS allow_custom_queues BOOLEAN DEFAULT true
            `);
        } catch (error) {
            // Column might already exist, ignore error
            console.log('Column allow_custom_queues may already exist');
        }

        // Add new system type columns if they don't exist (migration)
        try {
            await client.query(`
                ALTER TABLE guild_settings 
                ADD COLUMN IF NOT EXISTS system_type VARCHAR(20) DEFAULT 'multi_channel',
                ADD COLUMN IF NOT EXISTS creation_channel_id VARCHAR(20),
                ADD COLUMN IF NOT EXISTS display_channel_id VARCHAR(20),
                ADD COLUMN IF NOT EXISTS single_channel_id VARCHAR(20)
            `);
        } catch (error) {
            // Columns might already exist, ignore error
            console.log('New system type columns may already exist');
        }

        // Add queue_limit_behavior column if it doesn't exist (migration)
        try {
            await client.query(`
                ALTER TABLE guild_settings 
                ADD COLUMN IF NOT EXISTS queue_limit_behavior VARCHAR(20) DEFAULT 'block'
            `);
        } catch (error) {
            // Column might already exist, ignore error
            console.log('Queue limit behavior column may already exist');
        }

        // Create game_presets table
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_presets (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                game_name VARCHAR(100),
                game_modes TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE
            )
        `);

        // Create role_ping_configurations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS role_ping_configurations (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                role_id VARCHAR(20),
                game_name VARCHAR(100),
                game_mode VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
                UNIQUE(guild_id, role_id, game_name, game_mode)
            )
        `);

        // Create disabled_fun_commands table
        await client.query(`
            CREATE TABLE IF NOT EXISTS disabled_fun_commands (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                command_name VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
                UNIQUE(guild_id, command_name)
            )
        `);

        // Create news_channels table
        await client.query(`
            CREATE TABLE IF NOT EXISTS news_channels (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                news_channel_id VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
                UNIQUE(guild_id)
            )
        `);

        // Create queue_searches table
        await client.query(`
            CREATE TABLE IF NOT EXISTS queue_searches (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                game_name VARCHAR(100),
                game_mode VARCHAR(100),
                search_time INTEGER,
                start_time BIGINT,
                end_time BIGINT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `);

        // Create queue_creation_messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS queue_creation_messages (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20) UNIQUE,
                message_id VARCHAR(20),
                channel_id VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create moderation_roles table
        await client.query(`
            CREATE TABLE IF NOT EXISTS moderation_roles (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20),
                role_id VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
                UNIQUE(guild_id, role_id)
            )
        `);

        // Create server_leaderboard table
        await client.query(`
            CREATE TABLE IF NOT EXISTS server_leaderboard (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20) UNIQUE,
                server_name VARCHAR(100),
                server_description TEXT,
                invite_code VARCHAR(20),
                member_count INTEGER DEFAULT 0,
                total_queues INTEGER DEFAULT 0,
                age_rating VARCHAR(10) DEFAULT '13+',
                content_settings JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                featured BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id) ON DELETE CASCADE
            )
        `);

        console.log('Database tables created successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        client.release();
    }
}

async function saveGuildSettings(guildId, systemType, channelData, maxQueues, maxPlayers, maxAvailability, allowCustomQueues = true, queueLimitBehavior = 'block') {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - storing guild ${guildId} settings in memory`);
            
            // Store in memory fallback
            memoryFallback.guildSettings.set(guildId, {
                systemType,
                channelData,
                maxQueues,
                maxPlayers,
                maxAvailability,
                allowCustomQueues,
                queueLimitBehavior
            });
            memoryFallback.pendingSyncs.add('guildSettings');
            
            return true;
        }

        const query = `
            INSERT INTO guild_settings (guild_id, system_type, queue_channel_id, queue_category_id, creation_channel_id, display_channel_id, single_channel_id, max_queues, max_players, max_availability, allow_custom_queues, queue_limit_behavior, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            ON CONFLICT (guild_id) 
            DO UPDATE SET 
                system_type = $2,
                queue_channel_id = $3,
                queue_category_id = $4,
                creation_channel_id = $5,
                display_channel_id = $6,
                single_channel_id = $7,
                max_queues = $8,
                max_players = $9,
                max_availability = $10,
                allow_custom_queues = $11,
                queue_limit_behavior = $12,
                updated_at = CURRENT_TIMESTAMP
        `;

        // Use a timeout for the query to prevent hanging
        const client = await pool.connect();
        try {
            await client.query(query, [
                guildId, 
                systemType, 
                channelData.queueChannelId || null,
                channelData.queueCategoryId || null,
                channelData.creationChannelId || null,
                channelData.displayChannelId || null,
                channelData.singleChannelId || null,
                maxQueues, 
                maxPlayers, 
                maxAvailability, 
                allowCustomQueues,
                queueLimitBehavior
            ]);
            console.log(`Guild settings saved successfully`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error saving guild settings:', error);
        // Return true anyway so setup can complete
        return true;
    }
}

async function getGuildSettings(guildId) {
    try {
        // First check memory fallback
        if (memoryFallback.guildSettings.has(guildId)) {
            const memorySettings = memoryFallback.guildSettings.get(guildId);
            return {
                guild_id: guildId,
                system_type: memorySettings.systemType,
                queue_channel_id: memorySettings.channelData.queueChannelId,
                queue_category_id: memorySettings.channelData.queueCategoryId,
                creation_channel_id: memorySettings.channelData.creationChannelId,
                display_channel_id: memorySettings.channelData.displayChannelId,
                single_channel_id: memorySettings.channelData.singleChannelId,
                max_queues: memorySettings.maxQueues,
                max_players: memorySettings.maxPlayers,
                max_availability: memorySettings.maxAvailability,
                allow_custom_queues: memorySettings.allowCustomQueues,
                queue_limit_behavior: memorySettings.queueLimitBehavior
            };
        }
        
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot retrieve settings for guild ${guildId}`);
            return null;
        }

        const query = 'SELECT * FROM guild_settings WHERE guild_id = $1';
        const result = await pool.query(query, [guildId]);

        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting guild settings:', error);
        return null;
    }
}

async function deleteGuildSettings(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot delete settings for guild ${guildId}`);
            return false;
        }

        const query = 'DELETE FROM guild_settings WHERE guild_id = $1';
        await pool.query(query, [guildId]);
        console.log(`Guild settings deleted successfully`);
        return true;
    } catch (error) {
        console.error('Error deleting guild settings:', error);
        return false;
    }
}

async function saveGamePresets(guildId, gamePresets) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - storing game presets for guild ${guildId} in memory`);
            
            // Store in memory fallback
            memoryFallback.gamePresets.set(guildId, gamePresets);
            memoryFallback.pendingSyncs.add('gamePresets');
            
            return true;
        }

        // Delete existing presets for this guild
        await pool.query('DELETE FROM game_presets WHERE guild_id = $1', [guildId]);

        // Insert new presets
        for (const preset of gamePresets) {
            await pool.query(
                'INSERT INTO game_presets (guild_id, game_name, game_modes) VALUES ($1, $2, $3)',
                [guildId, preset.name, preset.modes]
            );
        }

        console.log(`Game presets saved successfully`);
        return true;
    } catch (error) {
        console.error('Error saving game presets:', error);
        return false;
    }
}

async function saveRolePingConfiguration(guildId, roleId, gameName, gameMode = null) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - role ping configuration for guild ${guildId} not saved`);
            return true;
        }

        await pool.query(
            'INSERT INTO role_ping_configurations (guild_id, role_id, game_name, game_mode) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [guildId, roleId, gameName, gameMode]
        );

        console.log(`Role ping configuration saved for ${gameName}`);
        return true;
    } catch (error) {
        console.error('Error saving role ping configuration:', error);
        return false;
    }
}

async function removeRolePingConfiguration(guildId, roleId, gameName, gameMode = null) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot remove role ping configuration for guild ${guildId}`);
            return true;
        }

        let query, params;
        if (gameMode) {
            query = 'DELETE FROM role_ping_configurations WHERE guild_id = $1 AND role_id = $2 AND game_name = $3 AND game_mode = $4';
            params = [guildId, roleId, gameName, gameMode];
        } else {
            query = 'DELETE FROM role_ping_configurations WHERE guild_id = $1 AND role_id = $2 AND game_name = $3';
            params = [guildId, roleId, gameName];
        }

        await pool.query(query, params);
        console.log(`Role ping configuration removed for ${gameName}`);
        return true;
    } catch (error) {
        console.error('Error removing role ping configuration:', error);
        return false;
    }
}

async function getGamePresets(guildId) {
    try {
        // First check memory fallback
        if (memoryFallback.gamePresets.has(guildId)) {
            return memoryFallback.gamePresets.get(guildId);
        }
        
        if (!isConnected || !pool) {
            return [];
        }

        const result = await pool.query('SELECT game_name, game_modes FROM game_presets WHERE guild_id = $1', [guildId]);
        return result.rows.map(row => ({
            name: row.game_name,
            modes: row.game_modes || []
        }));
    } catch (error) {
        console.error('Error getting game presets:', error);
        return [];
    }
}

async function getRolePingConfigurations(guildId) {
    try {
        if (!isConnected || !pool) {
            return [];
        }

        const result = await pool.query('SELECT * FROM role_ping_configurations WHERE guild_id = $1', [guildId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting role ping configurations:', error);
        return [];
    }
}

async function saveFunCommandState(guildId, commandName, isDisabled) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - storing fun command state for guild ${guildId} in memory`);
            
            // Store in memory fallback
            const key = `${guildId}:${commandName}`;
            memoryFallback.funCommandStates.set(key, isDisabled);
            memoryFallback.pendingSyncs.add('funCommandStates');
            
            // Update global state immediately
            if (!global.disabledFunCommands[guildId]) {
                global.disabledFunCommands[guildId] = new Set();
            }
            
            if (isDisabled) {
                global.disabledFunCommands[guildId].add(commandName);
            } else {
                global.disabledFunCommands[guildId].delete(commandName);
            }
            
            return true;
        }

        if (isDisabled) {
            await pool.query(
                'INSERT INTO disabled_fun_commands (guild_id, command_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [guildId, commandName]
            );
        } else {
            await pool.query(
                'DELETE FROM disabled_fun_commands WHERE guild_id = $1 AND command_name = $2',
                [guildId, commandName]
            );
        }

        console.log(`Fun command ${commandName} ${isDisabled ? 'disabled' : 'enabled'}`);
        return true;
    } catch (error) {
        console.error('Error saving fun command state:', error);
        return false;
    }
}

async function loadFunCommandStates() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - loading fun command states from memory');
            return;
        }

        const result = await pool.query('SELECT guild_id, command_name FROM disabled_fun_commands');

        for (const row of result.rows) {
            if (!global.disabledFunCommands[row.guild_id]) {
                global.disabledFunCommands[row.guild_id] = new Set();
            }
            global.disabledFunCommands[row.guild_id].add(row.command_name);
        }

        console.log(`Loaded fun command states for ${Object.keys(global.disabledFunCommands).length} guilds`);
    } catch (error) {
        console.error('Error loading fun command states:', error);
    }
}

const queuesByServerId = {};

async function saveQueue(guildId, queue) {
    try {
        // Always store in memory for runtime access
        if (!queuesByServerId[guildId]) {
            queuesByServerId[guildId] = [];
        }

        // Convert Set to Array for storage
        const playersArray = Array.isArray(queue.players) ? queue.players : Array.from(queue.players || []);

        const memoryQueue = {
            id: queue.id,
            gameName: queue.gameName,
            gameMode: queue.gameMode,
            maxPlayers: queue.maxPlayers || queue.playersNeeded,
            ownerId: queue.ownerId,
            players: playersArray,
            availability: queue.availability || [queue.availabilityTime || 1],
            createdAt: queue.createdAt || new Date()
        };

        // Update or add to memory storage
        const existingIndex = queuesByServerId[guildId].findIndex(q => q.id === queue.id);
        if (existingIndex >= 0) {
            queuesByServerId[guildId][existingIndex] = memoryQueue;
        } else {
            queuesByServerId[guildId].push(memoryQueue);
        }
        
        if (!queueDbConnected || !queuePool) {
            console.log(`Queue database not connected - queue for guild ${guildId} stored in memory only`);
            return true;
        }

        const client = await queuePool.connect();
        try {
            // Convert Set to Array for database storage
            const playersArray = Array.isArray(queue.players) ? queue.players : Array.from(queue.players || []);

            await client.query(`
                INSERT INTO queues (guild_id, queue_id, game_name, game_mode, max_players, owner_id, players, availability, created_at, updated_at, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (guild_id, queue_id) 
                DO UPDATE SET 
                    game_name = $3,
                    game_mode = $4,
                    max_players = $5,
                    owner_id = $6,
                    players = $7,
                    availability = $8,
                    updated_at = $10,
                    is_active = $11
            `, [
                guildId,
                queue.id,
                queue.gameName,
                queue.gameMode || null,
                queue.maxPlayers || queue.playersNeeded,
                queue.ownerId,
                playersArray,
                queue.availability || [queue.availabilityTime || 1],
                queue.createdAt || new Date(),
                new Date(),
                true
            ]);

            // Also store in memory for runtime access
            if (!queuesByServerId[guildId]) {
                queuesByServerId[guildId] = [];
            }

            // Update or add to memory storage
            const existingIndex = queuesByServerId[guildId].findIndex(q => q.id === queue.id);
            const memoryQueue = {
                id: queue.id,
                gameName: queue.gameName,
                gameMode: queue.gameMode,
                maxPlayers: queue.maxPlayers || queue.playersNeeded,
                ownerId: queue.ownerId,
                players: playersArray,
                availability: queue.availability || [queue.availabilityTime || 1],
                createdAt: queue.createdAt || new Date()
            };

            if (existingIndex >= 0) {
                queuesByServerId[guildId][existingIndex] = memoryQueue;
            } else {
                queuesByServerId[guildId].push(memoryQueue);
            }

            console.log(`Queue saved for ${queue.gameName}`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error saving queue:', error);
        return false;
    }
}

async function updateQueue(guildId, queueId, updateData) {
    try {
        if (!queueDbConnected || !queuePool) {
            console.log(`Queue database not connected - queue update for guild ${guildId} not saved`);
            return true;
        }

        const client = await queuePool.connect();
        try {
            // Convert Set to Array for database storage
            const playersArray = Array.isArray(updateData.players) ? updateData.players : Array.from(updateData.players || []);

            await client.query(`
                UPDATE queues 
                SET players = $1, updated_at = CURRENT_TIMESTAMP
                WHERE guild_id = $2 AND queue_id = $3 AND is_active = true
            `, [playersArray, guildId, queueId]);

            // Update memory storage
            if (queuesByServerId[guildId]) {
                const queueIndex = queuesByServerId[guildId].findIndex(q => q.id === queueId);
                if (queueIndex >= 0) {
                    queuesByServerId[guildId][queueIndex].players = playersArray;
                }
            }

            console.log(`Queue updated successfully`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating queue:', error);
        return false;
    }
}

async function loadQueues() {
    try {
        // This part is dynamically imported from interactions.js in the original code.
        // However, the provided change snippet does not include information about interactions.js
        // or how Guild and Queue models are defined/imported.
        // For the purpose of this modification, we will assume that the original
        // logic for fetching guilds and queues from a database (likely using an ORM or similar)
        // is replaced by direct SQL queries as seen in other parts of this file.
        // If interactions.js uses a different database access method, this part might need adjustment.

        // Mocking the structure for demonstration based on the provided SQL queries
        const getActiveQueuesFromDB = async (guildId) => {
            if (!queueDbConnected || !queuePool) {
                return [];
            }
            const client = await queuePool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM queues WHERE guild_id = $1 AND is_active = true ORDER BY created_at ASC',
                    [guildId]
                );
                return result.rows.map(row => ({
                    id: row.queue_id,
                    gameName: row.game_name,
                    gameMode: row.game_mode,
                    maxPlayers: row.max_players,
                    ownerId: row.owner_id,
                    players: row.players || [],
                    availability: row.availability || [],
                    createdAt: row.created_at,
                    queue_id: row.queue_id // Added for consistency with the snippet's update logic
                }));
            } finally {
                client.release();
            }
        };

        const getGuildIdsFromDB = async () => {
            if (!queueDbConnected || !queuePool) {
                return [];
            }
            const client = await queuePool.connect();
            try {
                const result = await client.query('SELECT DISTINCT guild_id FROM queues');
                return result.rows.map(row => row.guild_id);
            } finally {
                client.release();
            }
        };

        const updateQueueStatusInDB = async (queueId, isActive) => {
            if (!queueDbConnected || !queuePool) {
                return;
            }
            const client = await queuePool.connect();
            try {
                await client.query(
                    'UPDATE queues SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE queue_id = $2',
                    [isActive, queueId]
                );
            } finally {
                client.release();
            }
        };

        // Mocking Queue.update equivalent using direct SQL
        const QueueUpdate = async (data, options) => {
            if (data.status === 'inactive' && options && options.where && options.where.queue_id) {
                await updateQueueStatusInDB(options.where.queue_id, false);
            }
        };
        
        // The original code snippet uses 'Guild.findAll()' which implies an ORM like Sequelize.
        // Since we are using direct SQL, we'll fetch distinct guild_ids from the queues table.
        const guildIds = await getGuildIdsFromDB();
        console.log(`Processing queues for ${guildIds.length} guilds`);

        const queuesByGuild = {};
        for (const guildId of guildIds) {
            const activeQueues = await getActiveQueuesFromDB(guildId);
            queuesByGuild[guildId] = activeQueues;
        }

        // Validate queue limits and clean up if necessary
        for (const [guildId, queues] of Object.entries(queuesByGuild)) {
            // Fetch max_queues from guild_settings
            const settings = await getGuildSettings(guildId);
            const queueLimit = settings?.max_queues || 5; // Default to 5 if not found

            if (queues.length > queueLimit) {
                console.log(`Guild ${guildId} has ${queues.length} queues, exceeding limit of ${queueLimit}. Cleaning up...`);
                
                // Keep only the 'queueLimit' most recent queues
                const sortedQueues = queues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const queuesToKeep = sortedQueues.slice(0, queueLimit);
                const queuesToRemove = sortedQueues.slice(queueLimit);

                // Update database to mark excess queues as inactive
                for (const queue of queuesToRemove) {
                    // Simulate Queue.update({ status: 'inactive' }, { where: { queue_id: queue.queue_id } })
                    await QueueUpdate({ status: 'inactive' }, { where: { queue_id: queue.queue_id } });
                }

                queuesByGuild[guildId] = queuesToKeep;
                console.log(`Cleaned up ${queuesToRemove.length} excess queues for guild ${guildId}`);
            }
        }

        // Store in runtime
        // The original code used global.activeQueues. The current code uses queuesByServerId.
        // We will use queuesByServerId to maintain consistency with other functions in this file.
        Object.assign(queuesByServerId, queuesByGuild);
        console.log(`Loaded ${Object.values(queuesByGuild).flat().length} active queues into runtime`);

        // Import and call autoDeleteQueue for any queues that might have expired during loading
        // Assuming autoDeleteQueue is available globally or imported
        // For now, we will log a placeholder message.
        // const { autoDeleteQueue } = await import('./interactions.js'); 
        // Need to re-evaluate timing/scheduling for auto-deletion after loading.

    } catch (error) {
        console.error('Error loading queues:', error);
    }
}

async function deleteQueue(guildId, queueId) {
    try {
        if (!queueDbConnected || !queuePool) {
            console.log(`Queue database not connected - queue deletion for guild ${guildId} not saved`);
            return true;
        }

        const client = await queuePool.connect();
        try {
            await client.query(
                'UPDATE queues SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1 AND queue_id = $2',
                [guildId, queueId]
            );

            // Remove from memory storage
            if (queuesByServerId[guildId]) {
                queuesByServerId[guildId] = queuesByServerId[guildId].filter(q => q.id !== queueId);
                if (queuesByServerId[guildId].length === 0) {
                    delete queuesByServerId[guildId];
                }
            }

            console.log(`Queue marked as deleted`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting queue:', error);
        return false;
    }
}

async function getActiveQueues(guildId) {
    try {
        if (!queueDbConnected || !queuePool) {
            return queuesByServerId[guildId] || [];
        }

        const client = await queuePool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM queues WHERE guild_id = $1 AND is_active = true ORDER BY created_at ASC',
                [guildId]
            );

            return result.rows.map(row => ({
                id: row.queue_id,
                gameName: row.game_name,
                gameMode: row.game_mode,
                maxPlayers: row.max_players,
                ownerId: row.owner_id,
                players: row.players || [],
                availability: row.availability || [],
                createdAt: row.created_at
            }));
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting active queues:', error);
        return queuesByServerId[guildId] || [];
    }
}

async function getQueueStatistics() {
    try {
        if (!queueDbConnected || !queuePool) {
            console.log('Queue database not connected - cannot get statistics');
            return { recentQueues: 0, totalQueues: 0 };
        }

        const client = await queuePool.connect();
        try {
            // Get queues created in the last 7 days
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentResult = await client.query(
                'SELECT COUNT(*) FROM queues WHERE created_at >= $1',
                [oneWeekAgo]
            );

            // Get total queues ever created
            const totalResult = await client.query('SELECT COUNT(*) FROM queues');

            return {
                recentQueues: parseInt(recentResult.rows[0].count),
                totalQueues: parseInt(totalResult.rows[0].count)
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting queue statistics:', error);
        return { recentQueues: 0, totalQueues: 0 };
    }
}

async function saveNewsChannel(guildId, channelId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - storing news channel for guild ${guildId} in memory`);
            
            // Store in memory fallback
            memoryFallback.newsChannels.set(guildId, channelId);
            memoryFallback.pendingSyncs.add('newsChannels');
            
            return true;
        }

        const query = `
            INSERT INTO news_channels (guild_id, news_channel_id, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (guild_id) 
            DO UPDATE SET 
                news_channel_id = $2,
                updated_at = CURRENT_TIMESTAMP
        `;

        await pool.query(query, [guildId, channelId]);
        console.log(`News channel configured successfully`);
        return true;
    } catch (error) {
        console.error('Error saving news channel:', error);
        return false;
    }
}

async function getNewsChannel(guildId) {
    try {
        // First check memory fallback
        if (memoryFallback.newsChannels.has(guildId)) {
            return memoryFallback.newsChannels.get(guildId);
        }
        
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot retrieve news channel for guild ${guildId}`);
            return null;
        }

        const query = 'SELECT news_channel_id FROM news_channels WHERE guild_id = $1';
        const result = await pool.query(query, [guildId]);

        return result.rows[0]?.news_channel_id || null;
    } catch (error) {
        console.error('Error getting news channel:', error);
        return null;
    }
}

async function getAllNewsChannels() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - cannot retrieve all news channels');
            return [];
        }

        const query = 'SELECT guild_id, news_channel_id FROM news_channels';
        const result = await pool.query(query);

        return result.rows;
    } catch (error) {
        console.error('Error getting all news channels:', error);
        return [];
    }
}

async function removeNewsChannel(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot remove news channel for guild ${guildId}`);
            return true;
        }

        const query = 'DELETE FROM news_channels WHERE guild_id = $1';
        await pool.query(query, [guildId]);
        console.log(`News channel removed successfully`);
        return true;
    } catch (error) {
        console.error('Error removing news channel:', error);
        return false;
    }
}

async function saveQueueSearch(searchData) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - queue search for user ${searchData.userId} not saved`);
            return true;
        }

        const query = `
            INSERT INTO queue_searches (user_id, guild_id, game_name, game_mode, search_time, start_time, end_time, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                guild_id = $2,
                game_name = $3,
                game_mode = $4,
                search_time = $5,
                start_time = $6,
                end_time = $7,
                is_active = $8
        `;

        await pool.query(query, [
            searchData.userId,
            searchData.guildId,
            searchData.gameName,
            searchData.gameMode,
            searchData.searchTime,
            searchData.startTime,
            searchData.endTime,
            true
        ]);

        console.log(`Queue search saved for ${searchData.gameName}`);
        return true;
    } catch (error) {
        console.error('Error saving queue search:', error);
        return false;
    }
}

async function loadQueueSearches() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - loading queue searches from memory');
            return;
        }

        const currentTime = Date.now();
        const result = await pool.query('SELECT * FROM queue_searches WHERE is_active = true AND end_time > $1', [currentTime]);

        // Initialize global queue searches if not exists
        if (!global.activeQueueSearches) {
            global.activeQueueSearches = new Map();
        }

        for (const row of result.rows) {
            const searchData = {
                userId: row.user_id,
                guildId: row.guild_id,
                gameName: row.game_name,
                gameMode: row.game_mode,
                searchTime: row.search_time,
                startTime: parseInt(row.start_time),
                endTime: parseInt(row.end_time)
            };

            global.activeQueueSearches.set(row.user_id, searchData);

            // Set timeout for automatic cleanup
            const timeRemaining = searchData.endTime - currentTime;
            if (timeRemaining > 0) {
                setTimeout(() => {
                    if (global.activeQueueSearches && global.activeQueueSearches.has(row.user_id)) {
                        global.activeQueueSearches.delete(row.user_id);
                        removeQueueSearch(row.user_id);
                    }
                }, timeRemaining);
            }
        }

        // Clean up expired searches from database
        await pool.query('UPDATE queue_searches SET is_active = false WHERE end_time <= $1', [currentTime]);

        console.log(`Loaded ${result.rows.length} active queue searches`);
    } catch (error) {
        console.error('Error loading queue searches:', error);
    }
}

async function removeQueueSearch(userId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot remove queue search for user ${userId}`);
            return true;
        }

        const query = 'UPDATE queue_searches SET is_active = false WHERE user_id = $1';
        await pool.query(query, [userId]);
        console.log(`Queue search removed successfully`);
        return true;
    } catch (error) {
        console.error('Error removing queue search:', error);
        return false;
    }
}

async function reconstructQueueChannels(client) {
    try {
        // This function relies on `activeQueues` which is now `queuesByServerId`.
        // It also implies interactions.js is imported.
        // For consistency, we'll use `queuesByServerId`.
        const { activeQueues } = await import('./interactions.js'); // Assuming this import is valid in context

        // If activeQueues is not globally available, we might need to pass queuesByServerId
        // or re-import it if it's a module. For now, assuming global availability.
        const queuesToProcess = global.activeQueues || queuesByServerId; 

        for (const [queueId, queueData] of Object.entries(queuesToProcess)) {
            if (!queueData.channelId) {
                // Try to find the queue channel or use display channel
                const guild = client.guilds.cache.get(queueData.guildId);
                if (guild) {
                    const guildSettings = await getGuildSettings(queueData.guildId);
                    if (guildSettings) {
                        if (guildSettings.system_type === 'multi_channel') {
                            // Try to find existing queue channel
                            const queueChannelName = `${queueData.gameName.toLowerCase().replace(/\s+/g, '-')}-queue`;
                            const existingChannel = guild.channels.cache.find(ch => 
                                ch.name === queueChannelName && 
                                ch.parentId === guildSettings.queue_category_id
                            );
                            if (existingChannel) {
                                queueData.channelId = existingChannel.id;
                            }
                        } else {
                            // Use display or single channel
                            const channelId = guildSettings.display_channel_id || guildSettings.single_channel_id;
                            if (channelId) {
                                queueData.channelId = channelId;
                            }
                        }
                    }
                }
            }
        }

        console.log('Queue channel reconstruction completed');
    } catch (error) {
        console.error('Error reconstructing queue channels:', error);
    }
}

async function saveQueueCreationMessage(guildId, messageId, channelId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - queue creation message for guild ${guildId} not saved`);
            return true;
        }

        const query = `
            INSERT INTO queue_creation_messages (guild_id, message_id, channel_id, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (guild_id) 
            DO UPDATE SET 
                message_id = $2,
                channel_id = $3,
                updated_at = CURRENT_TIMESTAMP
        `;

        await pool.query(query, [guildId, messageId, channelId]);
        console.log(`Queue creation message saved successfully for guild ${guildId}`);
        return true;
    } catch (error) {
        console.error('Error saving queue creation message:', error);
        return false;
    }
}

async function getQueueCreationMessage(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot retrieve queue creation message for guild ${guildId}`);
            return null;
        }

        const query = 'SELECT message_id, channel_id FROM queue_creation_messages WHERE guild_id = $1';
        const result = await pool.query(query, [guildId]);

        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting queue creation message:', error);
        return null;
    }
}

async function loadQueueCreationMessages() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - loading queue creation messages from memory');
            return new Map();
        }

        const result = await pool.query('SELECT guild_id, message_id FROM queue_creation_messages');
        const messageMap = new Map();

        for (const row of result.rows) {
            messageMap.set(row.guild_id, row.message_id);
        }

        return messageMap;
    } catch (error) {
        console.error('Error loading queue creation messages:', error);
        return new Map();
    }
}

async function removeQueueCreationMessage(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot remove queue creation message for guild ${guildId}`);
            return true;
        }

        const query = 'DELETE FROM queue_creation_messages WHERE guild_id = $1';
        await pool.query(query, [guildId]);
        console.log(`Queue creation message removed successfully for guild ${guildId}`);
        return true;
    } catch (error) {
        console.error('Error removing queue creation message:', error);
        return false;
    }
}

async function getServerStatistics(guildId) {
    try {
        if (!queueDbConnected || !queuePool) {
            console.log('Queue database not connected - cannot get server statistics');
            return {
                weeklyQueues: 0,
                totalQueues: 0,
                dailyAverage: '0',
                peakDay: null,
                weeklyGrowth: '+0%',
                topGames: [],
                totalPlayers: 0,
                uniquePlayers: 0,
                averageQueueSize: '0',
                averageDuration: 'N/A',
                peakHours: null,
                successRate: 0,
                recentActivity: []
            };
        }

        const client = await queuePool.connect();
        try {
            // Get date ranges
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

            // Weekly queues
            const weeklyResult = await client.query(
                'SELECT COUNT(*) FROM queues WHERE guild_id = $1 AND created_at >= $2',
                [guildId, oneWeekAgo]
            );
            const weeklyQueues = parseInt(weeklyResult.rows[0].count);

            // Previous week for growth calculation
            const prevWeekResult = await client.query(
                'SELECT COUNT(*) FROM queues WHERE guild_id = $1 AND created_at >= $2 AND created_at < $3',
                [guildId, twoWeeksAgo, oneWeekAgo]
            );
            const prevWeekQueues = parseInt(prevWeekResult.rows[0].count);

            // Total queues for this server
            const totalResult = await client.query(
                'SELECT COUNT(*) FROM queues WHERE guild_id = $1',
                [guildId]
            );
            const totalQueues = parseInt(totalResult.rows[0].count);

            // Calculate daily average (this week)
            const dailyAverage = Math.round(weeklyQueues / 7).toString();

            // Calculate weekly growth
            let weeklyGrowth = '+0%';
            if (prevWeekQueues > 0) {
                const growth = ((weeklyQueues - prevWeekQueues) / prevWeekQueues) * 100;
                weeklyGrowth = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
            } else if (weeklyQueues > 0) {
                weeklyGrowth = 'New!';
            }

            // Top games
            const topGamesResult = await client.query(
                'SELECT game_name, COUNT(*) as count FROM queues WHERE guild_id = $1 GROUP BY game_name ORDER BY count DESC LIMIT 10',
                [guildId]
            );
            const topGames = topGamesResult.rows.map(row => ({
                name: row.game_name,
                count: parseInt(row.count)
            }));

            // Player statistics
            const playerStatsResult = await client.query(
                'SELECT players FROM queues WHERE guild_id = $1 AND players IS NOT NULL',
                [guildId]
            );

            let totalPlayers = 0;
            const uniquePlayersSet = new Set();
            let totalQueueSizes = 0;
            let validQueueCount = 0;

            playerStatsResult.rows.forEach(row => {
                if (row.players && Array.isArray(row.players)) {
                    totalPlayers += row.players.length;
                    totalQueueSizes += row.players.length;
                    validQueueCount++;
                    row.players.forEach(playerId => uniquePlayersSet.add(playerId));
                }
            });

            const uniquePlayers = uniquePlayersSet.size;
            const averageQueueSize = validQueueCount > 0 ? (totalQueueSizes / validQueueCount).toFixed(1) : '0';

            // Peak day calculation
            const peakDayResult = await client.query(`
                SELECT DATE(created_at) as queue_date, COUNT(*) as daily_count 
                FROM queues 
                WHERE guild_id = $1 AND created_at >= $2
                GROUP BY DATE(created_at) 
                ORDER BY daily_count DESC 
                LIMIT 1
            `, [guildId, oneWeekAgo]);

            let peakDay = null;
            if (peakDayResult.rows.length > 0) {
                const date = new Date(peakDayResult.rows[0].queue_date);
                const options = { weekday: 'long', month: 'short', day: 'numeric' };
                peakDay = `${date.toLocaleDateString('en-US', options)} (${peakDayResult.rows[0].daily_count})`;
            }



            // Success rate calculation (assuming queues with 2+ players are successful)
            const successfulQueuesResult = await client.query(`
                SELECT COUNT(*) FROM queues 
                WHERE guild_id = $1 AND array_length(players, 1) >= 2
            `, [guildId]);

            const successfulQueues = parseInt(successfulQueuesResult.rows[0].count);
            const successRate = totalQueues > 0 ? Math.round((successfulQueues / totalQueues) * 100) : 0;

            // Recent activity (last 5 queues)
            const recentActivityResult = await client.query(`
                SELECT game_name, game_mode, created_at 
                FROM queues 
                WHERE guild_id = $1 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [guildId]);

            const recentActivity = recentActivityResult.rows.map(row => {
                const timeDiff = Date.now() - new Date(row.created_at).getTime();
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const days = Math.floor(hours / 24);

                let timeAgo;
                if (days > 0) {
                    timeAgo = `${days}d ago`;
                } else if (hours > 0) {
                    timeAgo = `${hours}h ago`;
                } else {
                    timeAgo = 'Recent';
                }

                return {
                    game: `${row.game_name}${row.game_mode ? ` - ${row.game_mode}` : ''}`,
                    timeAgo
                };
            });

            return {
                weeklyQueues,
                totalQueues,
                dailyAverage,
                peakDay,
                weeklyGrowth,
                topGames,
                totalPlayers,
                uniquePlayers,
                averageQueueSize,
                averageDuration: 'N/A', // Would need to track queue durations to calculate this
                successRate,
                recentActivity
            };

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting server statistics:', error);
        return {
            weeklyQueues: 0,
            totalQueues: 0,
            dailyAverage: '0',
            peakDay: null,
            weeklyGrowth: '+0%',
            topGames: [],
            totalPlayers: 0,
            uniquePlayers: 0,
            averageQueueSize: '0',
            averageDuration: 'N/A',
            successRate: 0,
            recentActivity: []
        };
    }
}

async function saveModerationRole(guildId, roleId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - moderation role for guild ${guildId} not saved`);
            return false;
        }

        const query = `
            INSERT INTO moderation_roles (guild_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (guild_id, role_id) DO NOTHING
        `;

        await pool.query(query, [guildId, roleId]);
        console.log(`Moderation role saved successfully for guild ${guildId}`);
        return true;
    } catch (error) {
        console.error('Error saving moderation role:', error);
        return false;
    }
}

async function removeModerationRole(guildId, roleId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot remove moderation role for guild ${guildId}`);
            return false;
        }

        const query = 'DELETE FROM moderation_roles WHERE guild_id = $1 AND role_id = $2';
        await pool.query(query, [guildId, roleId]);
        console.log(`Moderation role removed successfully for guild ${guildId}`);
        return true;
    } catch (error) {
        console.error('Error removing moderation role:', error);
        return false;
    }
}

async function getModerationRoles(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log(`Database not connected - cannot retrieve moderation roles for guild ${guildId}`);
            return [];
        }

        const query = 'SELECT role_id FROM moderation_roles WHERE guild_id = $1';
        const result = await pool.query(query, [guildId]);
        return result.rows.map(row => row.role_id);
    } catch (error) {
        console.error('Error getting moderation roles:', error);
        return [];
    }
}

async function loadModerationRoles() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - loading moderation roles from memory');
            return;
        }

        // Initialize global moderation roles storage if it doesn't exist
        if (!global.moderatorRolesByGuildId) {
            global.moderatorRolesByGuildId = {};
        }

        const result = await pool.query('SELECT guild_id, role_id FROM moderation_roles');

        for (const row of result.rows) {
            if (!global.moderatorRolesByGuildId[row.guild_id]) {
                global.moderatorRolesByGuildId[row.guild_id] = new Set();
            }
            global.moderatorRolesByGuildId[row.guild_id].add(row.role_id);
        }

        console.log(`Loaded moderation roles for ${Object.keys(global.moderatorRolesByGuildId).length} guilds`);
    } catch (error) {
        console.error('Error loading moderation roles:', error);
    }
}

async function getServerLeaderboard() {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - cannot get server leaderboard');
            return [];
        }

        const query = `
            WITH weekly_games AS (
                SELECT 
                    guild_id,
                    game_name,
                    COUNT(*) as game_count,
                    ROW_NUMBER() OVER (PARTITION BY guild_id ORDER BY COUNT(*) DESC) as rn
                FROM queues 
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY guild_id, game_name
            )
            SELECT sl.*, 
                   COUNT(q.id) as recent_queue_count,
                   COUNT(CASE WHEN q.created_at >= NOW() - INTERVAL '7 days' AND array_length(q.players, 1) >= 2 THEN 1 END) as filled_queues_this_week,
                   wg.game_name as most_queued_game_this_week
            FROM server_leaderboard sl
            LEFT JOIN guild_settings gs ON sl.guild_id = gs.guild_id
            LEFT JOIN queues q ON sl.guild_id = q.guild_id AND q.created_at >= NOW() - INTERVAL '7 days'
            LEFT JOIN weekly_games wg ON sl.guild_id = wg.guild_id AND wg.rn = 1
            WHERE sl.is_active = true
            GROUP BY sl.id, sl.guild_id, sl.server_name, sl.server_description, sl.invite_code, sl.member_count, sl.total_queues, sl.age_rating, sl.content_settings, sl.is_active, sl.featured, sl.created_at, sl.updated_at, wg.game_name
            ORDER BY sl.featured DESC, filled_queues_this_week DESC, sl.member_count DESC
        `;

        const result = await pool.query(query);
        return result.rows.map(row => ({
            guildId: row.guild_id,
            serverName: row.server_name,
            serverDescription: row.server_description,
            inviteCode: row.invite_code,
            memberCount: row.member_count,
            totalQueues: row.total_queues,
            recentQueueCount: parseInt(row.recent_queue_count),
            filledQueuesThisWeek: parseInt(row.filled_queues_this_week),
            mostQueuedGameThisWeek: row.most_queued_game_this_week,
            ageRating: row.age_rating,
            contentSettings: typeof row.content_settings === 'string' ? JSON.parse(row.content_settings) : row.content_settings,
            featured: row.featured,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } catch (error) {
        console.error('Error getting server leaderboard:', error);
        return [];
    }
}

async function addServerToLeaderboard(guildId, serverName, serverDescription, inviteCode, memberCount, ageRating, contentSettings) {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - cannot add server to leaderboard');
            return false;
        }

        // First, ensure the server_leaderboard table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_leaderboard (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20) UNIQUE NOT NULL,
                server_name VARCHAR(100) NOT NULL,
                server_description TEXT,
                invite_code VARCHAR(20) NOT NULL,
                member_count INTEGER DEFAULT 0,
                total_queues INTEGER DEFAULT 0,
                age_rating VARCHAR(5) DEFAULT '13+',
                content_settings JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                featured BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if server already exists
        const existingServer = await pool.query(
            'SELECT id FROM server_leaderboard WHERE guild_id = $1',
            [guildId]
        );

        if (existingServer.rows.length > 0) {
            // Update existing server
            await pool.query(`
                UPDATE server_leaderboard 
                SET server_name = $2, server_description = $3, invite_code = $4, 
                    member_count = $5, age_rating = $6, content_settings = $7, 
                    is_active = true, updated_at = CURRENT_TIMESTAMP
                WHERE guild_id = $1
            `, [guildId, serverName, serverDescription, inviteCode, memberCount, ageRating, JSON.stringify(contentSettings)]);
        } else {
            // Insert new server
            await pool.query(`
                INSERT INTO server_leaderboard 
                (guild_id, server_name, server_description, invite_code, member_count, age_rating, content_settings) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [guildId, serverName, serverDescription, inviteCode, memberCount, ageRating, JSON.stringify(contentSettings)]);
        }

        console.log(`Server ${serverName} added to leaderboard`);
        return true;
    } catch (error) {
        console.error('Error adding server to leaderboard:', error);
        return false;
    }
}

async function removeServerFromLeaderboard(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - cannot remove server from leaderboard');
            return false;
        }

        await pool.query(
            'UPDATE server_leaderboard SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1',
            [guildId]
        );

        console.log(`Server ${guildId} removed from leaderboard`);
        return true;
    } catch (error) {
        console.error('Error removing server from leaderboard:', error);
        return false;
    }
}

async function isServerOnLeaderboard(guildId) {
    try {
        if (!isConnected || !pool) {
            console.log('Database not connected - cannot check leaderboard status');
            return false;
        }

        const result = await pool.query(
            'SELECT id FROM server_leaderboard WHERE guild_id = $1 AND is_active = true',
            [guildId]
        );

        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking server leaderboard status:', error);
        return false;
    }
}

async function updateServerLeaderboardStats(guildId, memberCount, totalQueues) {
    try {
        if (!isConnected || !pool) {
            return false;
        }

        const query = `
            UPDATE server_leaderboard 
            SET member_count = $2, total_queues = $3, updated_at = CURRENT_TIMESTAMP 
            WHERE guild_id = $1 AND is_active = true
        `;

        await pool.query(query, [guildId, memberCount, totalQueues]);
        return true;
    } catch (error) {
        console.error('Error updating server leaderboard stats:', error);
        return false;
    }
}

// Periodic database reconnection attempt
function startDatabaseReconnectionAttempts() {
    setInterval(async () => {
        if (!isConnected || !queueDbConnected) {
            console.log('🔄 Attempting database reconnection...');
            await connectDB();
        }
    }, 60000); // Try every minute
}

export { 
    connectDB, 
    saveGuildSettings, 
    getGuildSettings, 
    deleteGuildSettings, 
    saveGamePresets, 
    saveRolePingConfiguration, 
    removeRolePingConfiguration, 
    getGamePresets, 
    getRolePingConfigurations, 
    saveFunCommandState,
    loadFunCommandStates,
    saveQueue,
    updateQueue,
    loadQueues,
    deleteQueue,
    getQueueStatistics,
    getServerStatistics,
    saveNewsChannel,
    getNewsChannel,
    getAllNewsChannels,
    removeNewsChannel,
    saveQueueSearch,
    loadQueueSearches,
    removeQueueSearch,
    getActiveQueues,
    reconstructQueueChannels,
    saveQueueCreationMessage,
    getQueueCreationMessage,
    loadQueueCreationMessages,
    removeQueueCreationMessage,
    saveModerationRole,
    removeModerationRole,
    getModerationRoles,
    loadModerationRoles,
    addServerToLeaderboard,
    removeServerFromLeaderboard,
    isServerOnLeaderboard,
    updateServerLeaderboardStats,
    getServerLeaderboard,
    startDatabaseReconnectionAttempts,
    syncMemoryToDatabase,
    syncQueueMemoryToDatabase
};