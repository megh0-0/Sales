const mongoose = require('mongoose');

const checkDB = async () => {
  const uri = 'mongodb+srv://mamegh00_db_user:TqjymprkP8rgk2vY@cluster0.rdl1tfp.mongodb.net/sales-app';
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections found:', collections.map(c => c.name));

    const User = mongoose.connection.collection('users');
    const user = await User.findOne({ phone: '1234567890' });
    
    if (user) {
      console.log('✅ Admin user FOUND in database');
      console.log('Name:', user.name);
      console.log('Role:', user.role);
    } else {
      console.log('❌ Admin user NOT FOUND in database');
    }
    
    process.exit();
  } catch (err) {
    console.error('Error connecting to DB:', err);
    process.exit(1);
  }
};

checkDB();
