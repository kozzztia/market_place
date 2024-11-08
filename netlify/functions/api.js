import { Client } from 'pg';
const key = process.env.NEON_PASSWORD;

export async function handler(event, context) {
    const path = event.path;
    const method = event.httpMethod;

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;

        if (method === 'GET' && path.endsWith('/items')) {
            // Получение элементов по id или всех элементов
            const id = event.queryStringParameters?.id;
            if (id) {
                // Если передан id, извлекаем конкретный элемент
                query = {
                    text: 'SELECT * FROM items WHERE id = $1',
                    values: [id],
                };
            } else {
                // Извлечение всех элементов
                query = 'SELECT * FROM items';
            }
            const res = await client.query(query);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        } else if (method === 'POST' && path.endsWith('/items')) {
            // Создание нового элемента
            const { item, cost, link } = JSON.parse(event.body);
            if (!item || !cost) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item and cost' }),
                };
            }

            query = {
                text: 'INSERT INTO items (item, cost, link) VALUES ($1, $2, $3) RETURNING *',
                values: [item, cost, link || null],
            };

            const res = await client.query(query);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }
    } catch (error) {
        console.error('Database query error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Database query error' }),
        };
    } finally {
        await client.end();
    }
}
