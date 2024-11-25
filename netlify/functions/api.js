const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const idMatch = path.match(/\/(\d+)$/); // Захватываем id из пути
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
            // Обработка GET-запросов
            if (path.endsWith('/items')) {
                query = 'SELECT id, name, description, price, icon, count, color FROM items';
            } else if (path.endsWith('/categories')) {
                query = 'SELECT DISTINCT category FROM items';
            } else if (path.endsWith('/randomItem')) {
                query = 'SELECT * FROM items ORDER BY RANDOM() LIMIT 1';
            } else if (path.endsWith('/topThreeItem')) {
                query = 'SELECT * FROM items ORDER BY rating DESC LIMIT 3';
            } else if (id) {
                if (path.match(/\/iswotch\/\d+$/)) {
                    query = {
                        text: 'SELECT iswotch FROM items WHERE id = $1',
                        values: [id],
                    };
                } else if (path.match(/\/count\/\d+$/)) {
                    query = {
                        text: 'SELECT count FROM items WHERE id = $1',
                        values: [id],
                    };
                } else if (path.match(/\/item\/\d+$/)) {
                    query = {
                        text: 'SELECT * FROM items WHERE id = $1',
                        values: [id],
                    };
                }
            }
        } else if (method === 'PUT' && id) {
            // Обработка PUT-запросов
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

        // Выполнение запроса
        const res = await client.query(query);

        // Обработка результатов запроса
        const responseRows = res.rows.map(row => {
            if (row.details) {
                try {
                    row.details = JSON.parse(row.details);
                } catch (error) {
                    console.warn('Failed to parse details field:', error);
                }
            }
            if (row.link) {
                row.link = row.link.split(',').map(url => url.trim());
            }
            if (row.color) {
                row.color = row.color.split(',').map(color => color.trim());
            }
            return row;
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(responseRows),
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
