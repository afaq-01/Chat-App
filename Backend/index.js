import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import Connectdb from "./Config/Config.js";
import router from "./Routes/Routes.js";
import Messages_Model from "./Models/Messages_Models.js";

const app = express();

/* ---------------------------- Middleware ---------------------------- */


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://chat-app-khaki-six-22.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json());


/* ---------------------------- Database ----------------------------- */

Connectdb();

/* ----------------------------- Routes ------------------------------ */

app.use("/api", router);

/* ---------------------- Create HTTP Server ------------------------- */
/*
Socket.IO cannot directly attach to Express.
It attaches to the underlying HTTP server.
*/

const server = http.createServer(app);

/* ---------------------- Create Socket Server ----------------------- */

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://chat-app-khaki-six-22.vercel.app"
    ],
    methods: ["GET", "POST"],
  },
});

/* ---------------------- Online Users Storage ----------------------- */
/*
Map structure:

{
   clerkId => socketId
}

Example:

{
   "user_123" => "abcXYZ123",
   "user_456" => "pqrs5678"
}
*/

const onlineUsers = new Map();

/* ---------------------- Socket Connection -------------------------- */

io.on("connection", (socket) => {
  /*
    When the frontend connects:

    const socket = io("http://localhost:5000", {
      auth: {
        clerkId: user.id
      }
    });

    This data becomes available here:
  */

  const clerkId = socket.handshake.auth.clerkId;

  console.log("--------------------------------");
  console.log("New User Connected");
  console.log("Clerk ID:", clerkId);
  console.log("Socket ID:", socket.id);

  /* Save relationship between clerk user and socket */

  if (clerkId) {
    onlineUsers.set(clerkId, socket.id);
  }

  console.log("Current Online Users:");
  console.log(Array.from(onlineUsers.entries()));

  /* -------------------- Temporary Group Chat -------------------- */
  /*
    Current behavior:
    If one user sends a message,
    every connected user receives it.
    */
  socket.on("send-message", async (data) => {
    try {
      const { senderId, receiverId, text, file, fileName, senderName } = data;

      const savedMessage = await Messages_Model.create({
        senderId,
        receiverId,
        text,
        file,
        fileName,
        senderName,
      });

      const receiverSocketId = onlineUsers.get(receiverId);

      socket.emit("receive-message", savedMessage);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive-message", savedMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  /* ----------------------- Disconnect Event ---------------------- */

  socket.on("disconnect", () => {
    console.log(`${clerkId} disconnected`);

    /*
      Remove user from online list
      because their socket no longer exists.
    */

    onlineUsers.delete(clerkId);

    console.log("Current Online Users:");
    console.log(Array.from(onlineUsers.entries()));
  });
});

/* --------------------------- Start Server -------------------------- */

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
