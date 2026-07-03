import mongoose from "mongoose";

const schema = new mongoose.Schema({
    clerkId: String,
    name: String,
    email: String,
    image: String
});

const User_Models = mongoose.model('user', schema);

export default User_Models;