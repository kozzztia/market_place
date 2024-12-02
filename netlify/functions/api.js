const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const idMatch = path.match(/\/(\d+)$/);
    const id = idMatch ? parseInt(idMatch[1], 10) : null;

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        };
    }

    try {
        await client.connect();

        let query;

        if (method === 'GET') {
            if (path.endsWith('/items')) {
                query = 'SELECT id, name, description, price, icon, category, rating, company FROM items';
            } else if (id) {
                query = {
                    text: 'SELECT * FROM items WHERE id = $1',
                    values: [id],
                };
            } else {
                return { statusCode: 404, body: JSON.stringify({ error: 'Endpoint not found' }) };
            }
        } else {
            return { statusCode: 404, body: JSON.stringify({ error: 'Method not allowed' }) };
        }

        const res = await client.query(query);

        if (!res.rows.length) {
            return {
                statusCode: 404,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: 'Data not found' }),
            };
        }

        const responseRows = res.rows.map(row => {
            if (row.details) {
                try {
                    row.details = JSON.parse(row.details);
                } catch (error) {
                    console.warn('Failed to parse details field:', error);
                }
            }
            if (row.link) row.link = row.link.split(',').map(url => url.trim());
            if (row.color) row.color = row.color.split(',').map(color => color.trim());
            return row;
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(responseRows),
        };
    } catch (error) {
        console.error('Database query error:', error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    } finally {
        await client.end();
    }
};
