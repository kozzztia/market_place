exports.handler = async (event, context) => {
    try {
        const response = await fetch('https://jsonplaceholder.typicode.com/posts');
        const data = await response.json();
        console.log(data);
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: error.toString()
        };
    }
}