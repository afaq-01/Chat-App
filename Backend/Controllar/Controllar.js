import User_Models from "../Models/User_Model.js";
import Messages_Model from "../Models/Messages_Models.js";
import cloudinary from "../config/cloudinary.js";

/*-----Controllar for  Adding a new user in  a database------*/
export const Adding_New_User = async (req, res) => {
    try {
        const { clerkId, name, email, image } = req.body;

        console.log({ userName: name })
        console.log(name)


        const existingUser = await User_Models.findOne({ clerkId });

        if (!existingUser) {
            const saving_data = new User_Models({
                clerkId,
                name,
                email,
                image,
            });

            await saving_data.save();

            return res.status(201).json({
                message: "User created",
                user: saving_data
            });
        }

        return res.status(200).json({
            message: "User already exists",
            user: existingUser
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};


/*-------Controllar for getting all user from database-----*/
export const Getting_All_User = async (req, res) => {
    try {

        console.log("All users endpoint called");

        const allUsers = await User_Models.find();

        console.log("Users fetched:", allUsers.length);

        return res.status(200).json(allUsers);
    } catch (error) {
        console.error("Error in Getting_All_User:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


/*-----------getting All messages----------*/
export const Get_Conversation_Messages = async (req, res) => {
    try {
        const { user1, user2 } = req.params;

        const messages = await Messages_Model.find({
            $or: [
                {
                    senderId: user1,
                    receiverId: user2,
                },
                {
                    senderId: user2,
                    receiverId: user1,
                }
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Server Error"
        });
    }
};

export const file_handler = async (req, res) => {
    try {
        console.log("req.file =", req.file);
        const image = req.file;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        const result = await cloudinary.uploader.upload(
            image.path,
            {
                folder: "uploads"
            }
        );


        const secure_url = result.secure_url
        console.log(secure_url)



    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
};

