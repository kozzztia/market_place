import { Client } from 'pg';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const key = process.env.NEON_PASSWORD;

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, 'public', 'images');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
        }
    })
});

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

        // 1. GET /items: Получение всех элементов или элемента по ID
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
        }

        // 2. POST /items: Создание нового элемента
        if (method === 'POST' && pathUrl.endsWith('/items')) {
            const { item, cost } = JSON.parse(event.body);

            if (!item || !cost) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item and cost' }),
                };
            }

            const link = `${pathUrl}/public/images/${item}`; // Пример ссылки на изображение

            query = {
                text: 'INSERT INTO items (item, cost, link) VALUES ($1, $2, $3) RETURNING *',
                values: [item, cost, link],
            };

            const res = await client.query(query);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        }

        // 3. POST /upload-image: Загрузка изображения с использованием multer
        if (method === 'POST' && pathUrl.endsWith('/upload-image')) {
            return new Promise((resolve, reject) => {
                const fakeRequest = {
                    headers: event.headers,
                    body: Buffer.from(event.body, 'base64'), // Преобразуем тело запроса в буфер
                };

                const fakeResponse = {
                    statusCode: 200,
                    setHeader: () => {},
                    end: (message) => {
                        resolve({
                            statusCode: 200,
                            body: message,
                        });
                    },
                };

                upload.single('image')(fakeRequest, fakeResponse, (err) => {
                    if (err) {
                        reject({
                            statusCode: 500,
                            body: JSON.stringify({ error: 'File upload error', details: err.message }),
                        });
                    }
                });
            });
        }

        // Если маршрут не найден
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
}
