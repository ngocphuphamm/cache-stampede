const Redis = require('ioredis');
const Redlock = require('redlock');

// Connect to Redis
const redisClient = new Redis({
  // your Redis configuration
});

// Create a Redlock instance
const redlock = new Redlock(
  [redisClient],
  {
    // Specify the retry count
    retryCount: 10,
    // Specify the retry delay
    retryDelay: 200, // time in ms
    // The maximum amount of time you want the resource locked
    driftFactor: 0.01 // time in ms
  }
);


const express = require('express');
const app = express();

app.get('/data', async (req, res) => {
  const resource = 'locks:your-resource-name';
  const ttl = 1000; // Lock time to live in milliseconds

  redlock.lock(resource, ttl).then(async function(lock) {
    try {
      let value = await redisClient.get('cacheKey');
      if (value) {
        // If the value exists, return it
        console.log('===== cache hit =====')
        res.send(value);
      } else {
        
        // get Database 
        value = await computeExpensiveResource();
        await redisClient.set('cacheKey', value, 'EX', 1000); 
        
        console.log('===== cache miss | request database =====')
        res.send(value);
      }
    } catch (err) {
      // Handle errors
      res.status(500).send('An error occurred');
    } finally {
      // Always release the lock
      console.log('===== release =====')
      return lock.unlock().catch(function(err) {
        // Log error if unlocking failed
        console.error('Failed to unlock', err);
      });
    }
  }).catch(function(err) {
    // Handle lock acquisition errors
    res.status(500).send('Could not acquire lock');
  });
});

function computeExpensiveResource() {
  // Function to compute the resource, which could be time-consuming
  return new Promise(resolve => setTimeout(() => resolve('Computed Value'), 2000));
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
