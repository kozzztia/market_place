const axios = require("axios");

exports.handler = async (event, context) => {
    const path = event.path;
    let response;

    try {
        if (path.endsWith('/users')) {
            response = await axios.get('https://jsonplaceholder.typicode.com/users');
        } else if (path.endsWith('/store')) {
            response = await axios.get('https://jsonplaceholder.typicode.com/todos');
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Endpoint not found' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error fetching data' })
        };
    }
};