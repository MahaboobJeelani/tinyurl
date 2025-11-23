const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set');
    console.log('Please set DATABASE_URL in your .env file or environment variables');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } || false
  });

  try {
    console.log('Connecting to Neon PostgreSQL database...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('Database connection successful');
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running database schema...');
    await pool.query(schemaSQL);
    console.log('Database schema created successfully!');
    
    // Verify tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables created:', tables.rows.map(row => row.table_name).join(', '));
    
    // Count sample data
    const count = await pool.query('SELECT COUNT(*) as count FROM links');
    console.log(`Sample links: ${count.rows[0].count}`);
    
  } catch (error) {
    console.error('Database setup error:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('ℹTables already exist - continuing...');
    } else {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;