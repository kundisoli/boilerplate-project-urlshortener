// Load environment variables
require('dotenv').config();

const uri = process.env.MONGODB_URI;
console.log('Mongo URI:', uri); 


const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const dns = require('dns');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI; 

let urlCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db('urlshortener');
    urlCollection = db.collection('urls');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1); // Stop the server if DB connection fails
  }
}
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(`${process.cwd()}/public`));

// Routes
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// URL Shortener API
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  try {
    const parsedUrl = new URL(originalUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.json({ error: 'invalid url' });
    }

    // Validate URL via DNS
    await new Promise((resolve, reject) => {
      dns.lookup(parsedUrl.hostname, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if URL already exists
    const existing = await urlCollection.findOne({ original_url: originalUrl });
    if (existing) {
      return res.json({
        original_url: existing.original_url,
        short_url: existing.short_url
      });
    }

    // Create new short URL
    const count = await urlCollection.countDocuments();
    const shortUrl = count + 1;

    const result = {
      original_url: originalUrl,
      short_url: shortUrl
    };

    await urlCollection.insertOne(result);
    res.json(result);

  } catch (err) {
    res.json({ error: 'invalid url' });
  }
});

// Redirect short URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = parseInt(req.params.short_url);

  try {
    const doc = await urlCollection.findOne({ short_url: shortUrl });

    if (doc) {
      return res.redirect(doc.original_url);
    } else {
      return res.json({ error: 'short url not found' });
    }
  } catch (err) {
    res.json({ error: 'invalid short url' });
  }
});

// Test API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ greeting: 'hello API' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
