const { Pool } = require('pg');
require('dotenv').config();

async function testLocalConnection() {
  console.log('Testing local PostgreSQL connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    const client = await pool.connect();
    console.log('Successfully connected to local PostgreSQL');
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    // Check if our table exists
    try {
      const tableResult = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'links')");
      if (tableResult.rows[0].exists) {
        console.log('Links table exists');
      } else {
        console.log('Links table does not exist yet');
      }
    } catch (tableError) {
      console.log('Could not check tables - database might be empty');
    }
    
    client.release();
  } catch (error) {
    console.error('Connection failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('Solution: Check your PostgreSQL username and password');
      console.log('Try connecting manually: psql -h localhost -U postgres -d tinylink');
    } else if (error.message.includes('does not exist')) {
      console.log('Solution: Create the database first');
      console.log('Command: createdb -U postgres tinylink');
    } else if (error.message.includes('connection refused')) {
      console.log('Solution: PostgreSQL might not be running');
      console.log('Start PostgreSQL: brew services start postgresql (macOS) or sudo service postgresql start (Linux)');
    }
  } finally {
    await pool.end();
  }
}

testLocalConnection();