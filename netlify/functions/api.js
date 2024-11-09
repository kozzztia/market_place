import { Client } from 'pg';

const key = process.env.NEON_PASSWORD;

export async function handler(event, context) {
    const method = event.httpMethod;
    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        if (method === 'GET' && event.path === '/items') {
            const query = 'SELECT * FROM items';
            const res = await client.query(query);

            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
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
