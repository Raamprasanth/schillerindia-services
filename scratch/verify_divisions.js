const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://developer:developer123@cluster0.o7xur.mongodb.net/shcl?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    try {
      const Division = require('../backend/models/Division');
      const Service = require('../backend/models/Service');
      
      const divs = await Division.find({}).lean();
      console.log('DIVISIONS:');
      divs.forEach(d => console.log(` - ${d._id}: name="${d.name}", displayName="${d.displayName}"`));
      
      const svcCounts = await Service.aggregate([{ $group: { _id: '$division', count: { $sum: 1 } } }]);
      console.log('\nSERVICE COUNTS by Division ID:');
      console.log(svcCounts);

      const svcNameCounts = await Service.aggregate([{ $group: { _id: '$divisionName', count: { $sum: 1 } } }]);
      console.log('\nSERVICE COUNTS by divisionName:');
      console.log(svcNameCounts);

    } catch (e) {
      console.error(e);
    } finally {
      process.exit(0);
    }
  });
