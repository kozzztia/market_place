const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const idMatch = path.match(/\/(\d+)$/);  // Захватываем id из пути
    const id = idMatch ? idMatch[1] : null;

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;

        if (method === 'GET') {
            // Все GET запросы
            if (path.endsWith('/items')) {
                // Fetch all items
                query = 'SELECT itemName, description, price, icon, count FROM items';
            } else if (id) {
                if (path.match(/\/iswotch\/\d+$/)) {
                    // Fetch iswotch by id
                    query = {
                        text: 'SELECT iswotch FROM items WHERE id = $1',
                        values: [id],
                    };
                } else if (path.match(/\/count\/\d+$/)) {
                    // Fetch count by id
                    query = {
                        text: 'SELECT count FROM items WHERE id = $1',
                        values: [id],
                    };
                } else {
                    // Fetch item by id
                    query = {
                        text: 'SELECT * FROM items WHERE id = $1',
                        values: [id],
                    };
                }
            }
        } else if (method === 'PUT' && id) {
            // Обработка PUT запросов
            const { count, iswotch } = JSON.parse(event.body);
            if (count === undefined && iswotch === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required field: count or iswotch' }),
                };
            }
            if (count !== undefined && !isNaN(count)) {
                query = {
                    text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                    values: [count, id],
                };
            } else if (iswotch !== undefined) {
                query = {
                    text: 'UPDATE items SET iswotch = $1 WHERE id = $2 RETURNING *',
                    values: [iswotch, id],
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid or missing value for count or iswotch' }),
                };
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }

        const res = await client.query(query);
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

