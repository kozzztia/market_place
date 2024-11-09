const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    
    const idMatch = path.match(/\/items\/(\d+)/);  
    const id = idMatch ? idMatch[1] : null; 

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;
        
        if (method === 'GET' && path.endsWith('/items')) {
            query = 'SELECT * FROM items';
        } else if (method === 'GET' && id) {
            query = {
                text: 'SELECT * FROM items WHERE id = $1',
                values: [id],
            };
        } else if (method === 'PUT' && id) {
            const { counter } = JSON.parse(event.body);

            if (counter === undefined || isNaN(counter)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing or invalid counter value' }),
                };
            }

            query = {
                text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                values: [counter, id],
            };
        } else if (method === 'POST' && path.endsWith('/items')) {

            const { item, description, count, link } = JSON.parse(event.body);

            if (!item || !description || !count || !link) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, description, and count' }),
                };
            }

            query = {
                text: 'INSERT INTO items (item, description, count, link) VALUES ($1, $2, $3, $4) RETURNING *',
                values: [item, description, count, link],
            };
        } else if (method === 'DELETE' && id) {
            query = {
                text: 'DELETE FROM items WHERE id = $1 RETURNING *',
                values: [id],
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }

        const res = await client.query(query);

        if (method === 'DELETE') {
            if (res.rowCount === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Item not found' }),
                };
            }
            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Item with id ${id} deleted successfully` }),
            };
        }

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
