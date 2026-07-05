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

/* ---------------------- Active Calls Storage ------------------------ */
/*
Tracks which clerkId is currently calling/in-call-with which other
clerkId, so that if either side disconnects mid-call we can notify
the other side to hang up cleanly.

Map structure: clerkId => partnerClerkId (set in both directions)
*/

const activeCalls = new Map();

/* ---------------------- Socket Connection -------------------------- */

io.on("connection", async (socket) => {
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

    // Let everyone know the current online list, so sidebars and
    // chat headers can show live online/offline status.
    io.emit("online-users", Array.from(onlineUsers.keys()));

    // Any messages sent to this user while they were offline are now
    // "delivered" (their app just received them). Update those
    // messages and tell each sender in real time so their tick
    // switches from single-grey to double-grey.
    try {
      const undeliveredMessages = await Messages_Model.find({
        receiverId: clerkId,
        status: "sent",
      });

      if (undeliveredMessages.length > 0) {
        await Messages_Model.updateMany(
          { receiverId: clerkId, status: "sent" },
          { $set: { status: "delivered" } }
        );

        const affectedSenderIds = [
          ...new Set(undeliveredMessages.map((m) => m.senderId)),
        ];

        affectedSenderIds.forEach((senderId) => {
          const senderSocketId = onlineUsers.get(senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit("messages-delivered", {
              deliveredTo: clerkId,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error marking offline messages as delivered:", error);
    }
  }

  console.log("Current Online Users:");
  console.log(Array.from(onlineUsers.entries()));

  /* -------------------- Send Message -------------------- */

  socket.on("send-message", async (data) => {
    try {
      const { senderId, receiverId, text, file, fileName, senderName } = data;

      const receiverSocketId = onlineUsers.get(receiverId);

      const savedMessage = await Messages_Model.create({
        senderId,
        receiverId,
        text,
        file,
        fileName,
        senderName,
        // If the receiver is online right now, their app receives it
        // immediately, so it's already "delivered" rather than just "sent".
        status: receiverSocketId ? "delivered" : "sent",
      });

      // Send message back to sender
      socket.emit("receive-message", savedMessage);

      // Send message to receiver if online
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive-message", savedMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  /* -------------------- Typing Indicators -------------------- */
  /*
    These must live at the top level of the connection handler,
    NOT nested inside send-message — otherwise they only get
    registered after a message has already been sent.

    EVENT-NAME CONTRACT (must match the frontend exactly):
      client -> server : "typing"        -> server -> client : "user-typing"
      client -> server : "stop-typing"    -> server -> client : "user-stop-typing"

    The frontend's Home_page.jsx emits "typing" / "stop-typing" and
    listens for "user-typing" / "user-stop-typing" to match this.
  */

  socket.on("typing", ({ senderId, receiverId }) => {
    console.log("SERVER got typing:", senderId, "->", receiverId);
    const receiverSocketId = onlineUsers.get(receiverId);
    console.log("SERVER receiver socket:", receiverSocketId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-typing", { senderId });
    }
  });

  socket.on("stop-typing", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-stop-typing", { senderId });
    }
  });

  /* -------------------- Audio Call Signaling -------------------- */
  /*
    This is pure signaling relay — the server never touches audio
    itself, it just passes WebRTC handshake messages (offer/answer/
    ICE candidates) between the two clients so their browsers can
    negotiate a direct peer-to-peer connection.

    Flow:
      caller  -> "call-user"    -> server -> callee : "incoming-call"
      callee  -> "answer-call"  -> server -> caller : "call-accepted"
      callee  -> "reject-call"  -> server -> caller : "call-rejected"
      either  -> "ice-candidate"-> server -> other   : "ice-candidate"
      either  -> "end-call"     -> server -> other   : "call-ended"
  */

  socket.on("call-user", ({ to, from, offer, callerName, callerImage }) => {
    const receiverSocketId = onlineUsers.get(to);

    if (!receiverSocketId) {
      // Callee is offline — tell the caller immediately
      socket.emit("call-rejected", { from: to, reason: "offline" });
      return;
    }

    // Tentatively pair them so a mid-ring disconnect can be cleaned up
    activeCalls.set(from, to);
    activeCalls.set(to, from);

    io.to(receiverSocketId).emit("incoming-call", {
      from,
      offer,
      callerName,
      callerImage,
    });
  });

  socket.on("answer-call", ({ to, from, answer }) => {
    const receiverSocketId = onlineUsers.get(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-accepted", { from, answer });
    }
  });

  socket.on("reject-call", ({ to, from, reason }) => {
    activeCalls.delete(from);
    activeCalls.delete(to);

    const receiverSocketId = onlineUsers.get(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-rejected", { from, reason });
    }
  });

  socket.on("ice-candidate", ({ to, from, candidate }) => {
    const receiverSocketId = onlineUsers.get(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("ice-candidate", { from, candidate });
    }
  });

  socket.on("end-call", ({ to, from }) => {
    activeCalls.delete(from);
    activeCalls.delete(to);

    const receiverSocketId = onlineUsers.get(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended", { from });
    }
  });

  /* -------------------- Read Receipts (Blue Ticks) -------------------- */
  /*
    Called by a client whenever it opens (or is actively viewing) a
    conversation. Marks every not-yet-seen message from that other
    person as "seen", then tells the original sender in real time so
    their double-grey ticks turn double-blue.
  */

  socket.on("mark-seen", async ({ viewerId, chatWithId }) => {
    try {
      const result = await Messages_Model.updateMany(
        {
          senderId: chatWithId,
          receiverId: viewerId,
          status: { $ne: "seen" },
        },
        { $set: { status: "seen" } }
      );

      if (result.modifiedCount > 0) {
        const senderSocketId = onlineUsers.get(chatWithId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messages-seen", { seenBy: viewerId });
        }
      }
    } catch (error) {
      console.error("Error marking messages as seen:", error);
    }
  });

  /* -------------------- Delete Message -------------------- */
  /*
    Two independent flows, like WhatsApp:

    "delete-message-everyone": only the original sender may do this.
      The message document is kept (for integrity) but its content is
      wiped and isDeletedForEveryone is set. Both sides are notified in
      real time so the bubble instantly turns into a placeholder.

    "delete-message-me": purely a per-user visibility flag. The
      requester's clerkId is added to deletedFor. Nothing is broadcast
      to the other user — it's only hidden on the requester's own
      screen (and stays hidden after reload, via the deletedFor filter
      in Get_Conversation_Messages).
  */

  socket.on("delete-message-everyone", async ({ messageId, requesterId, receiverId }) => {
    try {
      const message = await Messages_Model.findById(messageId);
      if (!message) return;

      // Only the original sender can delete a message for everyone
      if (message.senderId !== requesterId) return;

      message.isDeletedForEveryone = true;
      message.text = "";
      message.file = "";
      message.fileName = "";
      await message.save();

      const payload = { messageId };

      // Notify the requester's own other tabs/devices
      socket.emit("message-deleted-everyone", payload);

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-deleted-everyone", payload);
      }
    } catch (error) {
      console.error("Error deleting message for everyone:", error);
    }
  });

  socket.on("delete-message-me", async ({ messageId, requesterId }) => {
    try {
      await Messages_Model.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: requesterId },
      });

      // Confirm back to the requester only — this never affects the
      // other participant's view of the conversation.
      socket.emit("message-deleted-me", { messageId });
    } catch (error) {
      console.error("Error deleting message for me:", error);
    }
  });

  /* ----------------------- Disconnect Event ---------------------- */

  socket.on("disconnect", () => {
    console.log(`${clerkId} disconnected`);

    // If this user was mid-call, tell their partner to hang up
    const partnerId = activeCalls.get(clerkId);
    if (partnerId) {
      const partnerSocketId = onlineUsers.get(partnerId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit("call-ended", { from: clerkId });
      }
      activeCalls.delete(clerkId);
      activeCalls.delete(partnerId);
    }

    /*
      Remove user from online list
      because their socket no longer exists.
    */

    onlineUsers.delete(clerkId);

    // Let everyone know this user just went offline
    io.emit("online-users", Array.from(onlineUsers.keys()));

    console.log("Current Online Users:");
    console.log(Array.from(onlineUsers.entries()));
  });
});

/* --------------------------- Start Server -------------------------- */

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});