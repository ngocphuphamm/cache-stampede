const express = require('express');
const app = express();

const cacheStore = [];
const promiseCallingDBMaps = new Map();



app.get('/test', async (req, res) => {
    const key = 'someUniqueKey';
    const ttl = 3600; 
  
    try {
      // fetchDataFromDatabase should be a function that returns a promise for the data you want
      const value = await getFromCacheOrDb(key, fetchDataFromDatabase, ttl);
      res.json(value);
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      res.status(500).send('Server Error');
    }
  });
  

const getFromCacheOrDb = async (key, fetchDataFromDatabase, ttl) => {
  let value = await cache.get(key);
  if (value != null) {
    console.log('=== cache hit ====')
    return value;
  }

  // Check if key is being processed
  if (promiseCallingDBMaps.has(key)) {
    console.log('=== key just finished ====')
    // if user request concurrent will wait for the first request to finish at inline code
    return promiseCallingDBMaps.get(key);
  }

  try {
    const promise = fetchDataFromDatabase(); // Intentionally not using await here
    promiseCallingDBMaps.set(key, promise);
    value = await promise;
  } finally {
    promiseCallingDBMaps.delete(key);
  }

  await cache.set(key, value, ttl);
  return value;
};

function fetchDataFromDatabase() {
  return new Promise(resolve => {
    setTimeout(() => resolve({ data: 'fetched from database' }), 1000);
  });
}

const cache = {
    async get(key) {
      const cacheEntry = cacheStore.find(entry => entry.key === key);
      if (cacheEntry && (cacheEntry.expiry === null || cacheEntry.expiry > Date.now())) {
        return cacheEntry.value;
      }
      return null;
    },
  
    async set(key, value, ttl) {
      const expiry = Date.now() + ttl;
      const existingIndex = cacheStore.findIndex(entry => entry.key === key);
      if (existingIndex !== -1) {
        cacheStore[existingIndex] = { key, value, expiry };
      } else {
        cacheStore.push({ key, value, expiry });
      }
    }
  };
  


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
