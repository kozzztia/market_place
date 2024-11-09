const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const id = event.queryStringParameters?.id; // Get 'id' from query string

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        // Handling GET /items and GET /item/{id}
        if (method === 'GET' && path.endsWith('/items')) {
            let query;
            if (id) {
                // If 'id' is provided, fetch the specific item
                query = {
                    text: 'SELECT * FROM items WHERE id = $1',
                    values: [id],
                };
            } else {
                // If no 'id', fetch all items
                query = 'SELECT * FROM items';
            }

            const res = await client.query(query);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        }

        // Handling POST /item (Create new item)
        if (method === 'POST' && path.endsWith('/item')) {
            const { item, description, counter, link } = JSON.parse(event.body);

            // Check for required fields
            if (!item || !description || !counter || !link) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, description, counter, link' }),
                };
            }

            const query = {
                text: 'INSERT INTO items (item, description, counter, link) VALUES ($1, $2, $3, $4) RETURNING *',
                values: [item, description, counter, link],
            };

            const res = await client.query(query);

            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        }

        // Handling PUT /item/{id} (Update item)
        if (method === 'PUT' && path.startsWith('/item/')) {
            const idFromPath = path.split('/')[2];
            const { item, description, counter, link } = JSON.parse(event.body);

            if (!idFromPath) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'ID is required' }),
                };
            }

            // Only update provided fields (if any)
            const fields = [];
            const values = [];

            if (item) {
                fields.push('item = $' + (fields.length + 1));
                values.push(item);
            }
            if (description) {
                fields.push('description = $' + (fields.length + 1));
                values.push(description);
            }
            if (counter) {
                fields.push('counter = $' + (fields.length + 1));
                values.push(counter);
            }
            if (link) {
                fields.push('link = $' + (fields.length + 1));
                values.push(link);
            }

            if (fields.length === 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'No fields to update' }),
                };
            }

            // Add the ID as the last parameter
            values.push(idFromPath);

            const query = {
                text: `UPDATE items SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
                values: values,
            };

            const res = await client.query(query);

            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
            };
        }

        // Handling DELETE /item/{id} (Delete item)
        if (method === 'DELETE' && path.startsWith('/item/')) {
            const idFromPath = path.split('/')[2];

            if (!idFromPath) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'ID is required' }),
                };
            }

            const query = {
                text: 'DELETE FROM items WHERE id = $1 RETURNING *',
                values: [idFromPath],
            };

            const res = await client.query(query);

            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Item with ID ${idFromPath} deleted` }),
            };
        }

        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Endpoint not found' }),
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
