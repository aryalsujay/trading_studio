import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path
const DB_PATH = join(__dirname, '..', 'db', 'trading.db');

// Initialize database connection
let db = null;

export function initDatabase() {
    try {
        // Ensure db directory exists
        const dbDir = dirname(DB_PATH);
        if (!existsSync(dbDir)) {
            mkdirSync(dbDir, { recursive: true });
        }

        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance

        // Read and execute schema
        const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');

        // Execute schema in transaction
        db.exec(schema);

        console.log('✅ Database initialized successfully');
        return db;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

export function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

export function closeDatabase() {
    if (db) {
        db.close();
        console.log('Database connection closed');
    }
}

// Graceful shutdown
process.on('exit', closeDatabase);
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});
