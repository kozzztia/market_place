import { Client } from 'pg';
import fs from 'fs';
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

        let query;

        if (method === 'GET' && pathUrl.endsWith('/items')) {
            const id = event.queryStringParameters?.id;
            if (id) {
                query = {
                    text: 'SELECT * FROM items WHERE id = $1',
                    values: [id],
                };
            } else {
                query = 'SELECT * FROM items';
            }
            const res = await client.query(query);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        } else if (method === 'POST' && pathUrl.endsWith('/items')) {
            // Парсим form-data вручную без использования потоков
            const formData = JSON.parse(event.body);  // Парсим тело запроса как JSON

            const { item, cost, imageBase64 } = formData;

            if (!item || !cost || !imageBase64) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item, cost or image' }),
                };
            }

            // Сохраняем изображение на сервер
            const imageBuffer = Buffer.from(imageBase64, 'base64');
            const imagePath = path.join(process.cwd(), 'public', 'images', `${Date.now()}.jpg`);

            fs.writeFileSync(imagePath, imageBuffer);

            // Путь к изображению
            const link = `https://funny-fudge-ddda7b.netlify.app/images/${path.basename(imagePath)}`;

            // Сохраняем данные в базе данных
            query = {
                text: 'INSERT INTO items (item, cost, link) VALUES ($1, $2, $3) RETURNING *',
                values: [item, cost, link],
            };

            try {
                const res = await client.query(query);
                return {
                    statusCode: 201,
                    body: JSON.stringify(res.rows[0]),
                };
            } catch (dbError) {
                console.error('Database error:', dbError);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Database query error', details: dbError.message }),
                };
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }
    } catch (error) {
        console.error('Server error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error', details: error.message }),
        };
    } finally {
        await client.end();
    }
}
