// define dependencies
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const shortid = require('shortid');
const session = require('express-session'); //we're using 'express-session' as 'session' here
const bcrypt = require("bcrypt"); // 
const app = express();
const PORT = 3000; // you can change this if this port number is not available

//connect to database
mongoose.connect('mongodb://localhost:27017/auth_tuts', { //replace this with you
  useMongoClient: true}, (err, db) => {
    if (err) {
      console.log("Couldn't connect to database");
    } else {
      console.log(`Connected To Database`);
    }
  }
);

// define database schemas
const User = require('./models/user'); // we shall create this (model/user.js) soon 

// configure bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(
  session({
    secret: "iy98hcbh489n38984y4h498", // don't put this into your code at production.  Try using saving it into environment variable or a config file.
    resave: true,
    saveUninitialized: false
  })
);

/*
0. Unprotected route
=============
*/
app.get('/', (req, res) => {
  res.send('Welcome to the Home of our APP');
})

/*
1. User Sign up
=============
*/
// here we're expecting username, fullname, email and password in body of the request for signup. Note that we're using post http method
app.post('/signup', (req, res) => {
  let {username, fullname, email, password} = req.body; // this is called destructuring. We're extracting these variables and their values from 'req.body'
    
    let userData = {
    	username,
        password: bcrypt.hashSync(password, 5), // we are using bcrypt to hash our password before saving it to the database
        fullname,
        email
    };
    
    let newUser = new User(userData);
    newUser.save().then(error => {
    	if (!error) {
        	return res.status(201).json('signup successful')
        } else {
        	if (error.code ===  11000) { // this error gets thrown only if similar user record already exist.
            	return res.status(409).send('user already exist!')
            } else {
            	console.log(JSON.stringigy(error, null, 2)); // you might want to do this to examine and trace where the problem is emanating from
            	return res.status(500).send('error signing up user')
            }
        }
    })
})

/*
2. User Sign in
=============
We will be using username and password, but it can be improved or modified (e.g email and password or some other ways as you please)
*/
app.post('/login', (req, res) => {
  let {username, password} = req.body;
    User.findOne({username: username}, 'username email password', (err, userData) => {
    	if (!err) {
        	let passwordCheck = bcrypt.compareSync(password, userData.password);
        	if (passwordCheck) { // we are using bcrypt to check the password hash from db against the supplied password by user
                req.session.user = {
                  email: userData.email,
                  username: userData.username,
                  id: userData._id
                }; // saving some user's data into user's session
                req.session.user.expires = new Date(
                  Date.now() + 3 * 24 * 3600 * 1000 // session expires in 3 days
                );
                res.status(200).send('You are logged in, Welcome!');
            } else {
            	res.status(401).send('incorrect password');
            }
        } else {
        	res.status(401).send('invalid login credentials')
        }
    })
})

/*
3. authorization
=============
A simple way of implementing authorization is creating a simple middleware for it. Any endpoint that come after the authorization middleware wont pass if user doesn't have a valid session
*/
app.use((req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).send('Authrization failed! Please login');
  }
});

app.get('/protected', (req, res) => {
  res.send(`You seeing this because you have a valid session.
    	Your username is ${req.session.user.username} 
        and email is ${req.session.user.email}.
    `)
})

/*
4. Logout
=============
*/
app.all('/logout', (req, res) => {
  delete req.session.user; // any of these works
  	req.session.destroy(); // any of these works
    res.status(200).send('logout successful')
})

/*
4. Password reset
=================
We shall be using two endpoints to implement password reset functionality
*/
app.post('/forgot', (req, res) => {
  let {email} = req.body; // same as let email = req.body.email
  User.findOne({email: email}, (err, userData) => {
    if (!err) {
      userData.passResetKey = shortid.generate();
      userData.passKeyExpires = new Date().getTime() + 20 * 60 * 1000 // pass reset key only valid for 20 minutes
      userData.save().then(err => {
          if (!err) {
            // configuring smtp transport machanism for password reset email
            let transporter = nodemailer.createTransport({
              service: "gmail",
              port: 465,
              auth: {
                user: '', // your gmail address
                pass: '' // your gmail password
              }
            });
            let mailOptions = {
              subject: `NodeAuthTuts | Password reset`,
              to: email,
              from: `NodeAuthTuts <yourEmail@gmail.com>`,
              html: `
                <h1>Hi,</h1>
                <h2>Here is your password reset key</h2>
                <h2><code contenteditable="false" style="font-weight:200;font-size:1.5rem;padding:5px 10px; background: #EEEEEE; border:0">${passResetKey}</code></h4>
                <p>Please ignore if you didn't try to reset your password on our platform</p>
              `
            };
            try {
              transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                  console.log("error:\n", error, "\n");
                  res.status(500).send("could not send reset code");
                } else {
                  console.log("email sent:\n", response);
                  res.status(200).send("Reset Code sent");
                }
              });
            } catch (error) {
              console.log(error);
              res.status(500).send("could not sent reset code");
            }
          }
        })
    } else {
      res.status(400).send('email is incorrect');
    }
  })
});

app.post('/resetpass', (req, res) => {
  let {resetKey, newPassword} = req.body
    User.find({passResetKey: resetKey}, (err, userData) => {
    	if (!err) {
        	let now = new Date().getTime();
            let keyExpiration = userDate.passKeyExpires;
            if (keyExpiration > now) {
        userData.password = bcrypt.hashSync(newPassword, 5);
                userData.passResetKey = null; // remove passResetKey from user's records
                userData.keyExpiration = null;
                userData.save().then(err => { // save the new changes
                	if (!err) {
                    	res.status(200).send('Password reset successful')
                    } else {
                    	res.status(500).send('error resetting your password')
                    }
                })
            } else {
            	res.status(400).send('Sorry, pass key has expired. Please initiate the request for a new one');
            }
        } else {
        	res.status(400).send('invalid pass key!');
        }
    })
})

app.listen(PORT, () => {
  console.log(`app running port ${PORT}`)
})