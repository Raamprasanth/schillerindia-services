const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/shcl', {useNewUrlParser:true,useUnifiedTopology:true}).then(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let c of collections) {
    const docs = await c.find({
      $or: [
        {components: /R6,11 Re soldered/i},
        {compUsedToRepair: /R6,11 Re soldered/i},
        {componentsUsed: /R6,11 Re soldered/i},
        {partsUsed: /R6,11 Re soldered/i},
        {obComponents: /R6,11 Re soldered/i}
      ]
    }).toArray();
    if (docs.length) {
      console.log('Found in', c.collectionName, docs);
    }
  }
  mongoose.disconnect();
});
