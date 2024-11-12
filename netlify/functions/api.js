const { Client } = require('pg');
const key = process.env.NEON_PASSWORD;

exports.handler = async (event, context) => {
    const path = event.path;
    const method = event.httpMethod;
    const idMatch = path.match(/\/items\/(\d+)/);  
    const id = idMatch ? idMatch[1] : null; 

    const dbConfig = {
        connectionString: `postgresql://items_owner:${key}@ep-round-frost-a813d3a2.eastus2.azure.neon.tech/items?sslmode=require`,
        ssl: { rejectUnauthorized: false },
    };

    const client = new Client(dbConfig);

    try {
        await client.connect();

        let query;
        
        if (method === 'GET' && path.endsWith('/items')) {
            // Получение всех элементов
            query = 'SELECT itemName, description, price, icon, count FROM items';
        } else if (method === 'GET' && id) {
            // Получение элемента по id
            query = {
                text: 'SELECT * FROM items WHERE id = $1',
                values: [id],
            };
        } else if (method === 'PUT' && id) {
            // Обновление счетчика или iswotch по id
            const { count, iswotch } = JSON.parse(event.body);
            if (count === undefined && iswotch === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing required field: counter or iswotch' }),
                };
            }
            if (count !== undefined && !isNaN(count)) {
                query = {
                    text: 'UPDATE items SET count = $1 WHERE id = $2 RETURNING *',
                    values: [count, id],
                };
            } else if (iswotch !== undefined) {
                query = {
                    text: 'UPDATE items SET iswotch = $1 WHERE id = $2 RETURNING *',
                    values: [iswotch, id],
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid or missing value for counter or iswotch' }),
                };
            }
        } else if (method === 'POST' && path.endsWith('/items')) {
            // Создание нового элемента
            const { itemName, description, country, gender, age, color, price, icon, count, link, iswotch } = JSON.parse(event.body);
            
            if (!itemName || !description || !country || !gender || !age || !color || !price || !icon || !count || !link || !iswotch) {
                const missingFields = [];
            
                if (!itemName) missingFields.push('itemName');
                if (!description) missingFields.push('description');
                if (!country) missingFields.push('country');
                if (!gender) missingFields.push('gender');
                if (!age) missingFields.push('age');
                if (!color) missingFields.push('color');
                if (!price) missingFields.push('price');
                if (!icon) missingFields.push('icon');
                if (!count) missingFields.push('count');
                if (!link) missingFields.push('link');
                if (!iswotch) missingFields.push('iswotch');
            
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }),
                };
            }
            query = {
                text: 'INSERT INTO items (item, description, country, gender, age, color, price, icon, count, link, iswotch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
                values: [itemName, description, country, gender, age, color, price, icon, count, link, iswotch],
            };
        } else if (method === 'DELETE' && id) {
            // Удаление элемента по id
            query = {
                text: 'DELETE FROM items WHERE id = $1 RETURNING *',
                values: [id],
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' }),
            };
        }

        const res = await client.query(query);

        if (method === 'DELETE') {
            if (res.rowCount === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Item not found' }),
                };
            }
            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Item with id ${id} deleted successfully` }),
            };
        }

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


