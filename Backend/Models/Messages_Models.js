import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: String,
        receiverId: String,
        text: String,
        file: String,       // Cloudinary URL of attached file
        fileName: String,   // original file name, for display/download
        senderName: String,

        // true once the sender has "deleted for everyone" — content is
        // wiped from the document itself, so it's gone for both sides.
        isDeletedForEveryone: {
            type: Boolean,
            default: false,
        },

        // clerkIds of users who chose "delete for me" — the message
        // stays fully intact in the DB, just hidden from these users.
        deletedFor: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

const Messages_Model = mongoose.model("Message", messageSchema);

export default Messages_Model;