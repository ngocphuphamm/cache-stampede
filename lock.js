const express = require('express');
const Redis = require('ioredis');
const Redlock = require('redlock');

const app = express();
const redis = new Redis({
    keepAlive: true,
    retryStrategy: function(times) {
        var delay = Math.min(times * 3000, 60000);
        return delay;
    },
    reconnectOnError: err => {
        var targetError = 'READONLY';
        if (err.message.slice(0, targetError.length) === targetError) {
            // Only reconnect when the error starts with "READONLY"
            return true; // or `return 1;`
        }
    }
}); // Connect to Redis server

const redlock = new Redlock(
    [redis],
    {
        // Redlock configuration options
        driftFactor: 0.01, // time in ms
        retryCount: 25,
        retryDelay: 300, // time in ms
        retryJitter: 200 // time in ms
    })


app.get('/data', async (req, res) => {
    let data;

    // Try to get data from cache
    data = await redis.get('data_key');

    if (data) {
        console.log('cache hit')
        return res.json({ data: JSON.parse(data) });
    }
    // Acquire a lock
    console.log('acquire')
    const lock = await redlock.lock('locks:data_key', 1000);

    try {
        // Double-check if the data was set while acquiring the lock
        data = await redis.get('data_key');
        if (data) {
            console.log('cache hit layer2')
            await lock.unlock();
            return res.json({ data: JSON.parse(data) });
        }

        // Fetch data from the database or expensive operation
        data = await fetchDataFromDatabase();

        // Set data in Redis cache
        await redis.set('data_key', JSON.stringify(data), 'EX', 60); // Set cache with 60 seconds expiry
        console.log('data from db')
        // Return the response
        res.json({ data , message: 'Data Cache' });
    } catch (error) {
        res.status(500).send('Error fetching data');
    } finally {
        // Release the lock
        console.log('release')
        await lock.unlock();
    }
});

async function fetchDataFromDatabase() {
    // Simulate a database call
    return new Promise(resolve => setTimeout(() => resolve({ message: 'Data from DB' }), 100));
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
