import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: String,
        receiverId: String,
        text: String,
        senderName: String,
    },
    {
        timestamps: true,
    }
);

const Messages_Model = mongoose.model("Message", messageSchema);

export default Messages_Model;