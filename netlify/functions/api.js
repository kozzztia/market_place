const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const id = event.queryStringParameters?.id; // Get the id from the query string if available

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
            if (id) {
                // GET /items?id=1 - Retrieve item by ID
                query = {
                    text: 'SELECT * FROM items WHERE id = $1',
                    values: [id],
                };
            } else {
                // GET /items - Retrieve all items
                query = 'SELECT * FROM items';
            }
        } else if (method === 'POST' && path.endsWith('/items')) {
            // POST /items - Create new item
            const { item, description, count, link } = JSON.parse(event.body);

            // Check for required fields
            if (!item || !description || !count || !link) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, description, and count' }),
                };
            }

            query = {
                text: 'INSERT INTO items (item, description, count, link) VALUES ($1, $2, $3, $4) RETURNING *',
                values: [item, description, count, link], // link is optional
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
