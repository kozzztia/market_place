const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const key = process.env.NEON_PASSWORD;

// Database configuration
const dbConfig = {
    connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
    ssl: { rejectUnauthorized: false },
};

// Create an HTTP server for WebSocket
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('WebSocket server is running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });
const clients = new Set(); // Track connected clients

// Handle new WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Function to broadcast updates to all connected clients
function broadcastUpdate(update) {
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(update));
        }
    }
}

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const idMatch = path.match(/\/(\d+)$/);
    const id = idMatch ? idMatch[1] : null;

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;

        if (method === 'GET') {
            // Handle GET requests
            if (path.endsWith('/items')) {
                query = 'SELECT id, itemName, description, price, icon, count FROM items';
            } else if (id) {
                if (path.match(/\/iswotch\/\d+$/)) {
                    query = {
                        text: 'SELECT iswotch FROM items WHERE id = $1',
                        values: [id],
                    };
                } else if (path.match(/\/count\/\d+$/)) {
                    query = {
                        text: 'SELECT count FROM items WHERE id = $1',
                        values: [id],
                    };
                } else if (path.match(/\/item\/\d+$/)) {
                    query = {
                        text: 'SELECT * FROM items WHERE id = $1',
                        values: [id],
                    };
                }
            }
        } else if (method === 'PUT' && id) {
            // Handle PUT requests
            const { count, iswotch } = JSON.parse(event.body);
            if (count === undefined && iswotch === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required fields: count or iswotch' }),
                };
            }
            if (count !== undefined && !isNaN(count)) {
                query = {
                    text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                    values: [count, id],
                };
                // Notify WebSocket clients of the change
                broadcastUpdate({ id, field: 'count', newValue: count });
            } else if (iswotch !== undefined) {
                query = {
                    text: 'UPDATE items SET iswotch = $1 WHERE id = $2 RETURNING *',
                    values: [iswotch, id],
                };
                // Notify WebSocket clients of the change
                broadcastUpdate({ id, field: 'iswotch', newValue: iswotch });
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid or missing value for count or iswotch' }),
                };
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }

        const res = await client.query(query);
        return {
            statusCode: 200,
            body: JSON.stringify(res.rows),
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
};

// Start WebSocket server
server.listen(8080, () => {
    console.log('WebSocket server running at ws://localhost:8080');
});
