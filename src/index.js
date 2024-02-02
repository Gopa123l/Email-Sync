const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors= require('cors');
const app= express();
require('dotenv').config();

const PORT = 5004;
const MONGODB_URI= process.env.MONGODB_URI;


mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});





