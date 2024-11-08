import { Client } from 'pg';
import * as Busboy from 'busboy';  // Исправленный импорт
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

        if (method === 'GET' && pathUrl.endsWith('/items')) {
            // Получение элементов
            const id = event.queryStringParameters?.id;
            let query;
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
            // Обработка multipart запроса с помощью busboy
            const busboy = new Busboy({ headers: event.headers });

            let item = '';
            let cost = '';
            let imageFile = null;

            busboy.on('field', (name, value) => {
                if (name === 'item') {
                    item = value;
                } else if (name === 'cost') {
                    cost = value;
                }
            });

            busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
                // Путь к файлу на сервере
                const filePath = path.join(__dirname, 'public', 'images', Date.now() + '-' + filename);
                const writeStream = fs.createWriteStream(filePath);
                file.pipe(writeStream);

                imageFile = filePath;  // Путь к изображению
            });

            busboy.on('finish', async () => {
                // После завершения обработки данных запроса
                if (!item || !cost || !imageFile) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Missing required fields: item, cost or image' }),
                    };
                }

                // Ссылка на изображение
                const link = `https://funny-fudge-ddda7b.netlify.app/public/images/${path.basename(imageFile)}`;

                // Сохраняем данные в базе данных
                const query = {
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

            busboy.end(event.body);  // Завершаем обработку запроса
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
