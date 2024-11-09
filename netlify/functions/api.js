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

        if (method === 'GET' && pathUrl.endsWith('/items')) {
            // Получение элементов из базы данных
            const id = event.queryStringParameters?.id;
            const query = id 
                ? { text: 'SELECT * FROM items WHERE id = $1', values: [id] }
                : 'SELECT * FROM items';
            const res = await client.query(query);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        } else if (method === 'POST' && pathUrl.endsWith('/items')) {
            // Создание нового элемента
            const { item, cost } = JSON.parse(event.body);
            const link = `/public/images/${item}`; // Путь к изображению

            if (!item || !cost) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item and cost' }),
                };
            }

            const query = {
                text: 'INSERT INTO items (item, cost, link) VALUES ($1, $2, $3) RETURNING *',
                values: [item, cost, link],
            };
            const res = await client.query(query);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        } else if (method === 'POST' && pathUrl.endsWith('/upload-image')) {
            // Простая обработка загрузки файла без использования сторонних библиотек
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            if (!contentType.includes('multipart/form-data')) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid content type' }),
                };
            }

            // Определяем границу разделителя
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Boundary not found' }),
                };
            }

            // Разбираем тело запроса
            const body = Buffer.from(event.body, 'base64').toString('binary');
            const parts = body.split(`--${boundary}`);
            let fileData = null;
            let fileName = 'uploaded_image';

            parts.forEach((part) => {
                if (part.includes('Content-Disposition')) {
                    if (part.includes('filename=')) {
                        const match = part.match(/filename="(.+?)"/);
                        if (match) {
                            fileName = match[1];
                        }
                        const fileContentIndex = part.indexOf('\r\n\r\n') + 4;
                        fileData = part.substring(fileContentIndex, part.length - 2); // Отбрасываем завершающие символы
                    }
                }
            });

            if (!fileData) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'File data not found' }),
                };
            }

            // Сохраняем файл в netlify/public/images
            const imagesDir = path.join(__dirname, 'public', 'images'); // Убедитесь, что public/images существует в проекте Netlify
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            const filePath = path.join(imagesDir, fileName);
            fs.writeFileSync(filePath, fileData, 'binary');

            const fileLink = `https://funny-fudge-ddda7b.netlify.app/public/images/${fileName}`;

            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'File uploaded successfully', filePath: fileLink }),
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
