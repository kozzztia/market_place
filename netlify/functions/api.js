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

        // 1. GET /items
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

        // 2. POST /items
        if (method === 'POST' && pathUrl.endsWith('/items')) {
            const { item, cost } = JSON.parse(event.body);

            if (!item || !cost) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: item and cost' }),
                };
            }

            const link = `https://funny-fudge-ddda7b.netlify.app/public/images/${item}`;

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

        // 3. POST /upload-image
        if (method === 'POST' && pathUrl.endsWith('/upload-image')) {
            const boundary = event.headers['content-type'].split('boundary=')[1];
            const bodyBuffer = Buffer.from(event.body, 'base64');
            
            // Простая обработка multipart/form-data
            const parts = bodyBuffer.toString().split(`--${boundary}`);
            const filePart = parts.find(part => part.includes('Content-Disposition: form-data; name="image";'));
            
            if (!filePart) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'No image file found in request' }),
                };
            }

            const [headers, fileData] = filePart.split('\r\n\r\n');
            const filenameMatch = headers.match(/filename="(.+)"/);
            const filename = filenameMatch ? filenameMatch[1] : `upload-${Date.now()}`;

            const filePath = path.join(__dirname, 'public', 'images', filename);
            fs.writeFileSync(filePath, fileData.split('\r\n--')[0], { encoding: 'binary' });

            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'File uploaded successfully', filePath }),
            };
        }

        // Если маршрут не найден
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Endpoint not found' }),
        };
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
