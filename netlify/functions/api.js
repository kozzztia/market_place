import { Client } from 'pg';
import { IncomingForm } from 'formidable';  // Правильный импорт IncomingForm
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
            // Получение элементов по id или всех элементов
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
            // Обработка запроса с изображением
            const form = new IncomingForm();  // Используем IncomingForm из правильного импорта
            form.uploadDir = path.join(process.cwd(), 'public', 'images');
            form.keepExtensions = true;

            form.parse(event, async (err, fields, files) => {
                if (err) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'File upload error' }),
                    };
                }

                const { item, cost } = fields;
                const file = files.image;

                // Проверка обязательных полей
                if (!item || !cost || !file) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Missing required fields: item, cost or image' }),
                    };
                }

                // Путь к изображению
                const link = `https://funny-fudge-ddda7b.netlify.app/images/${file.newFilename}`;

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
            });
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
