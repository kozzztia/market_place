import { Client } from 'pg';
import path from 'path';

const key = process.env.NEON_PASSWORD;

export async function handler(event, context) {
    const pathUrl = event.path;
    const method = event.httpMethod;

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        if (method === 'GET' && pathUrl === '/items') {
            // Получить все элементы
            const query = 'SELECT * FROM items';
            const res = await client.query(query);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        } else if (method === 'GET' && pathUrl.startsWith('/items/')) {
            // Получить элемент по ID
            const id = pathUrl.split('/')[2];
            const query = {
                text: 'SELECT * FROM items WHERE id = $1',
                values: [id],
            };
            const res = await client.query(query);

            if (res.rows.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Item not found' }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
            };
        } else if (method === 'POST' && pathUrl === '/item') {
            // Создание нового элемента
            const { item, description, count, link } = JSON.parse(event.body);

            // Проверка обязательных полей
            if (!item || !description || count === undefined || !link) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, description, count, or link' }),
                };
            }

            const query = {
                text: 'INSERT INTO items (item, description, count, link) VALUES ($1, $2, $3, $4) RETURNING *',
                values: [item, description, count, link],
            };
            const res = await client.query(query);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        } else if (method === 'PUT' && pathUrl.startsWith('/item/')) {
            // Обновить count элемента по ID
            const id = pathUrl.split('/')[2];
            const { count } = JSON.parse(event.body);

            if (count === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required field: count' }),
                };
            }

            const query = {
                text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                values: [count, id],
            };
            const res = await client.query(query);

            if (res.rows.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Item not found' }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error', details: error.message }),
        };
    } finally {
        await client.end();
    }
}
