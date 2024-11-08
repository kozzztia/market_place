import { Client } from 'pg';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const key = process.env.NEON_PASSWORD;

// Настройка для загрузки изображений в папку public/images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);  // Генерация уникального имени для файла
    }
});

const upload = multer({ storage: storage });

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
            // Обработка запроса с изображением
            // Вызов multer для обработки формы с файлом
            upload.single('image')(event, context, async (err) => {
                if (err) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'File upload error', details: err.message }),
                    };
                }

                const { item, cost } = event.body;  // Получаем текстовые поля из тела запроса
                const file = event.file;  // Получаем информацию о файле, который был загружен

                // Проверка обязательных полей
                if (!item || !cost || !file) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Missing required fields: item, cost or image' }),
                    };
                }

                // Путь к изображению
                const link = `https://funny-fudge-ddda7b.netlify.app/public/images/${file.filename}`;

                // Сохраняем данные в базе данных
                const query = {
                    text: 'INSERT INTO items (item, cost, link) VALUES ($1, $2, $3) RETURNING *',
                    values: [item, cost, link], // Сохраняем путь к изображению
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
