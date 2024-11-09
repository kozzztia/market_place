const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    
    // Extracting the item ID directly from the path
    const idMatch = path.match(/\/items\/(\d+)/);  // This will match /items/1, /items/2, etc.
    const id = idMatch ? idMatch[1] : null; // If the ID is in the path, capture it; otherwise, it's null

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;
        
        if (method === 'GET' && path.endsWith('/items')) {
            // GET /items - Retrieve all items
            query = 'SELECT * FROM items';
        } else if (method === 'GET' && id) {
            // GET /items/{id} - Retrieve a specific item by ID
            query = {
                text: 'SELECT * FROM items WHERE id = $1',
                values: [id],
            };
        } else if (method === 'POST' && path.endsWith('/items')) {
            // POST /items - Create a new item
            const { item, description, count, link } = JSON.parse(event.body);

            // Check for required fields
            if (!item || !description || !count) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, description, and count' }),
                };
            }

            query = {
                text: 'INSERT INTO items (item, description, count, link) VALUES ($1, $2, $3, $4) RETURNING *',
                values: [item, description, count, link || null], // link is optional
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }

        const res = await client.query(query);

        // Return the results based on the query
        return {
            statusCode: 200,
            body: JSON.stringify(res.rows),
        };
    } catch (error) {
        console.error('Database query error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Database query error' }),
        };
    } finally {
        await client.end();
    }
};
