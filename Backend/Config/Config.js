import mongoose from 'mongoose';

const Connectdb = async () => {
  try {
    await mongoose.connect(
       "mongodb://e-commerce:Redapple1542002@cluster0-shard-00-00.8jfyr.mongodb.net:27017,cluster0-shard-00-01.8jfyr.mongodb.net:27017,cluster0-shard-00-02.8jfyr.mongodb.net:27017/Chating_App_DB?ssl=true&replicaSet=atlas-m9epio-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0"

    );
    console.log(' MongoDB connected');
  } catch (err) {
    console.error(' MongoDB connection error:', err.message);
  }
};

export default Connectdb;
