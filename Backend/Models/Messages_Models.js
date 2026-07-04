import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: String,
        receiverId: String,
        text: String,
        file: String,       // Cloudinary URL of attached file
        fileName: String,   // original file name, for display/download
        senderName: String,
    },
    {
        timestamps: true,
    }
);

const Messages_Model = mongoose.model("Message", messageSchema);

export default Messages_Model;