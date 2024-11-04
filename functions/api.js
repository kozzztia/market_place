const express = require("express");
const axios = require("axios");
const serverless = require("serverless-http");
const app = express();
app.use(express.json());

app.get('/api/users', async (req, res) => {
    try{
    const response = await axios.get('https://jsonplaceholder.typicode.com/users');
    res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});
app.get('/api/store', async (req, res) => {
    try{
    const response = await axios.get('https://jsonplaceholder.typicode.com/todos');
    res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching store' });
    }
});


module.exports.handler = serverless(app);