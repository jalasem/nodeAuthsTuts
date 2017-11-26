// define dependencies
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000; // you can change this if this port number is not available

//connect to database
mongoose.connect('mongodb://localhost:27017/auth_tuts', {
  useMongoClient: true
  }, (err, db) => {
    if (err) {
      console.log("Couldn't connect to database");
    } else {
      console.log(`Connected To Database`);
    }
  }
);

// define database schemas
const user = require('./models/user'); // we shall create this (model/user.js) soon 

// configure bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (req, res) => {
  res.send('Welcome to the Home of our APP');
})

app.get('/protected', (req, res) => {
  res.send('This page is protected. It requires authentication');
})

app.listen(PORT, () => {
  console.log(`app running port ${PORT}`)
})