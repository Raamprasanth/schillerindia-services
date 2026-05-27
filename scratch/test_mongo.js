const mongoose = require('mongoose');
const ecallRoutes = require('./backend/routes/ecallRoutes'); // Just to see if there's any obvious syntax issue

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/schiller'); // or whatever
    console.log("Connected");
  } catch(e) {
    console.log(e);
  }
})();
