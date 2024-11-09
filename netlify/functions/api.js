const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const id = event.queryStringParameters?.id; // Получаем параметр id из строки запроса

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;
        if (path.endsWith('/items') && id) {
            // Если передан параметр id, ищем конкретный элемент
            query = {
                text: 'SELECT * FROM items WHERE id = $1',
                values: [id],
            };
        } else if (path.endsWith('/items')) {
            // Если id не передан, извлекаем все элементы
            query = 'SELECT * FROM items';
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