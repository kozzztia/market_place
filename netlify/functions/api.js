const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const key = process.env.NEON_PASSWORD;

const dbConfig = {
    connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
    ssl: { rejectUnauthorized: false },
};

// Создаем HTTP сервер для работы с WebSocket
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('WebSocket сервер работает');
});

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });
const clients = new Set(); // Храним подключенных клиентов

// Подключение клиентов к WebSocket
wss.on('connection', (ws) => {
    console.log('Клиент подключен');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Клиент отключен');
        clients.delete(ws);
    });
});

// Функция для отправки обновлений клиентам
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
            // Обработка GET запросов
            if (path.endsWith('/items')) {
                query = 'SELECT itemName, description, price, icon, count FROM items';
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
            // Обработка PUT запросов
            const { count, iswotch } = JSON.parse(event.body);
            if (count === undefined && iswotch === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Отсутствует обязательное поле: count или iswotch' }),
                };
            }
            if (count !== undefined && !isNaN(count)) {
                query = {
                    text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                    values: [count, id],
                };
                // Уведомление WebSocket клиентов об изменении
                broadcastUpdate({ id, field: 'count', newValue: count });
            } else if (iswotch !== undefined) {
                query = {
                    text: 'UPDATE items SET iswotch = $1 WHERE id = $2 RETURNING *',
                    values: [iswotch, id],
                };
                // Уведомление WebSocket клиентов об изменении
                broadcastUpdate({ id, field: 'iswotch', newValue: iswotch });
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Неверное или отсутствующее значение для count или iswotch' }),
                };
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Эндпоинт не найден' }),
            };
        }

        const res = await client.query(query);
        return {
            statusCode: 200,
            body: JSON.stringify(res.rows),
        };
    } catch (error) {
        console.error('Ошибка запроса к базе данных:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Ошибка запроса к базе данных' }),
        };
    } finally {
        await client.end();
    }
};

// Запуск WebSocket сервера
server.listen(8080, () => {
    console.log('WebSocket сервер запущен на ws://localhost:8080');
});

