import { initDatabase, closeDatabase } from '../server/database.js';

console.log('🔄 Running Database Setup...');

try {
    initDatabase();
    console.log('✅ Database setup completed successfully.');
    closeDatabase();
} catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
}
