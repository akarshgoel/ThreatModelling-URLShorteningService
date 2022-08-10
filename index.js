const express = require('express');
const connectDB = require('./config/db');

const app = express();


//connect to DB
connectDB();

app.use(express.json({ extended: false }));


//define routes
app.use('/', require('./routes/index'));
app.use('/api/url', require ('./routes/url'));

const PORT = 5000;

app.listen(PORT, () => console.log(`server is running on ${PORT}`));
