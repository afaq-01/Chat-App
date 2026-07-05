import { useContext, useState, useEffect, useRef } from "react";
import Context from "../Components/Context";
import { useUser, useClerk } from "@clerk/clerk-react";
import { CgProfile } from "react-icons/cg";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";

const Home_page = () => {
  const { For_Search, setSearch, socket } = useContext(Context);

  const { openSignIn, signOut } = useClerk();
  const { user, isLoaded } = useUser();

  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null); // _id of message whose delete menu is open
  const [onlineUserIds, setOnlineUserIds] = useState([]); // clerkIds currently connected
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  /* -------------------- Audio Call State -------------------- */
  // callState: "idle" | "calling" (outgoing, waiting for answer)
  //          | "ringing" (incoming, waiting for user action) | "connected"
  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callerName, callerImage }
  const [activeCallPartner, setActiveCallPartner] = useState(null); // { clerkId, name, image }
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const currentCallPartnerRef = useRef(null); // clerkId of the other party, for signaling

  const ICE_SERVERS = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  /* -------------------- Online / Offline Tracking -------------------- */

  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (ids) => setOnlineUserIds(ids);

    socket.on("online-users", handleOnlineUsers);

    return () => {
      socket.off("online-users", handleOnlineUsers);
    };
  }, [socket]);

  const isUserOnline = (clerkId) => onlineUserIds.includes(clerkId);

  /* -------------------- Read Receipts (Blue Ticks) -------------------- */

  const markConversationSeen = (otherUserId) => {
    if (!socket || !user || !otherUserId) return;
    socket.emit("mark-seen", { viewerId: user.id, chatWithId: otherUserId });
  };

  useEffect(() => {
    if (!socket) return;

    const handleMessagesDelivered = ({ deliveredTo }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === user?.id && m.receiverId === deliveredTo && m.status === "sent"
            ? { ...m, status: "delivered" }
            : m
        )
      );
    };

    const handleMessagesSeen = ({ seenBy }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === user?.id && m.receiverId === seenBy
            ? { ...m, status: "seen" }
            : m
        )
      );
    };

    socket.on("messages-delivered", handleMessagesDelivered);
    socket.on("messages-seen", handleMessagesSeen);

    return () => {
      socket.off("messages-delivered", handleMessagesDelivered);
      socket.off("messages-seen", handleMessagesSeen);
    };
  }, [socket, user]);

  const loadConversation = async (chatUser) => {
    try {
      const res = await axios.get(
        `https://brilliant-mindfulness-production-4965.up.railway.app/api/Previous_conversation/${user.id}/${chatUser.clerkId}`
      );

      setMessages(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (!selectedChat || !isLoaded || !user) return;
    loadConversation(selectedChat);
    // Reset typing indicator whenever the selected chat changes
    setIsTyping(false);
    // Tell the other person their messages have now been seen
    markConversationSeen(selectedChat.clerkId);
  }, [selectedChat, user, isLoaded]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);

      // If we're currently looking at the sender's chat, mark it seen
      // right away instead of waiting for the next chat switch.
      if (selectedChat && msg.senderId === selectedChat.clerkId && msg.receiverId === user?.id) {
        markConversationSeen(msg.senderId);
      }
    };

    socket.on("receive-message", handleMessage);

    return () => {
      socket.off("receive-message", handleMessage);
    };
  }, [socket, selectedChat, user]);

  /* -------------------- Typing Indicator (receive side) -------------------- */
  /*
    Server emits "user-typing" / "user-stop-typing" (see index.js),
    so we must listen for those exact event names here.
  */
  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = ({ senderId }) => {
      if (selectedChat && senderId === selectedChat.clerkId) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = ({ senderId }) => {
      if (selectedChat && senderId === selectedChat.clerkId) {
        setIsTyping(false);
      }
    };

    socket.on("user-typing", handleTypingStart);
    socket.on("user-stop-typing", handleTypingStop);

    return () => {
      socket.off("user-typing", handleTypingStart);
      socket.off("user-stop-typing", handleTypingStop);
    };
  }, [socket, selectedChat]);

  /* -------------------- Typing Indicator (emit side) -------------------- */
  /*
    Server listens for "typing" / "stop-typing", so we emit those
    exact event names when the local user types.
  */
  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (!socket || !user || !selectedChat) return;

    socket.emit("typing", {
      senderId: user.id,
      receiverId: selectedChat.clerkId,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", {
        senderId: user.id,
        receiverId: selectedChat.clerkId,
      });
    }, 1500);
  };

  useEffect(() => {
    // Clean up any pending typing timeout on unmount
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  /* -------------------- Audio Call: Peer Connection Setup -------------------- */

  const createPeerConnection = (remoteId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: remoteId,
          from: user.id,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanupCall();
      }
    };

    return pc;
  };

  const cleanupCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    currentCallPartnerRef.current = null;
    setIncomingCall(null);
    setActiveCallPartner(null);
    setCallState("idle");
    setCallDuration(0);
    setIsMuted(false);
  };

  /* -------------------- Audio Call: Caller Side -------------------- */

  const startCall = async () => {
    if (!user) {
      alert("Please Login");
      return;
    }
    if (!selectedChat) {
      alert("Please select a chat first");
      return;
    }
    if (callState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(selectedChat.clerkId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnectionRef.current = pc;
      currentCallPartnerRef.current = selectedChat.clerkId;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call-user", {
        to: selectedChat.clerkId,
        from: user.id,
        offer,
        callerName: user.firstName,
        callerImage: user.imageUrl,
      });

      setActiveCallPartner({
        clerkId: selectedChat.clerkId,
        name: selectedChat.name,
        image: selectedChat.image,
      });
      setCallState("calling");
    } catch (error) {
      console.error("Failed to start call:", error);
      alert("Could not access your microphone. Please check permissions.");
    }
  };

  /* -------------------- Audio Call: Callee Side -------------------- */

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(incomingCall.from);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnectionRef.current = pc;
      currentCallPartnerRef.current = incomingCall.from;

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: incomingCall.from,
        from: user.id,
        answer,
      });

      setActiveCallPartner({
        clerkId: incomingCall.from,
        name: incomingCall.callerName,
        image: incomingCall.callerImage,
      });
      setIncomingCall(null);
      setCallState("connected");
    } catch (error) {
      console.error("Failed to accept call:", error);
      alert("Could not access your microphone. Please check permissions.");
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socket.emit("reject-call", { to: incomingCall.from, from: user.id });
    }
    setIncomingCall(null);
    setCallState("idle");
  };

  /* -------------------- Audio Call: Shared Controls -------------------- */

  const endCall = () => {
    const partnerId =
      currentCallPartnerRef.current || incomingCall?.from || activeCallPartner?.clerkId;

    if (partnerId) {
      socket.emit("end-call", { to: partnerId, from: user.id });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = isMuted; // if currently muted, enable; else disable
    });
    setIsMuted((prev) => !prev);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* -------------------- Audio Call: Socket Signaling Listeners -------------------- */

  useEffect(() => {
    if (!socket || !user) return;

    const handleIncomingCall = ({ from, offer, callerName, callerImage }) => {
      // Already on a call or on another call screen — auto-decline
      if (callState !== "idle") {
        socket.emit("reject-call", { to: from, from: user.id, reason: "busy" });
        return;
      }
      setIncomingCall({ from, offer, callerName, callerImage });
      setCallState("ringing");
    };

    const handleCallAccepted = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState("connected");
      } catch (error) {
        console.error("Failed to set remote description:", error);
      }
    };

    const handleCallRejected = ({ reason }) => {
      cleanupCall();
      if (reason === "offline") {
        alert("User is offline");
      } else if (reason === "busy") {
        alert("User is busy on another call");
      } else {
        alert("Call was declined");
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    const handleCallEnded = () => {
      cleanupCall();
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-rejected", handleCallRejected);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-rejected", handleCallRejected);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, user, callState, incomingCall]);

  /* -------------------- Audio Call: Duration Timer -------------------- */

  useEffect(() => {
    if (callState === "connected") {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  /* -------------------- Audio Call: Cleanup on Unmount -------------------- */

  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!user) {
      alert("Please Login");
      return;
    }

    if (!selectedChat) {
      alert("Please select a chat first");
      return;
    }

    let fileUrl = null;
    let fileName = null;

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await axios.post(
          "https://brilliant-mindfulness-production-4965.up.railway.app/api/upload",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        fileUrl = uploadRes.data.url;
        fileName = uploadRes.data.fileName;
      }

      if (!message.trim() && !fileUrl) return;

      socket.emit("send-message", {
        senderId: user.id,
        receiverId: selectedChat.clerkId,
        text: message,
        file: fileUrl,
        fileName,
        senderName: user.firstName,
      });

      // Stop the typing indicator immediately once the message is sent
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit("stop-typing", {
        senderId: user.id,
        receiverId: selectedChat.clerkId,
      });

      setMessage("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Send message failed:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  /* -------------------- Delete Message: Socket Listeners -------------------- */

  useEffect(() => {
    if (!socket) return;

    const handleDeletedEveryone = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeletedForEveryone: true, text: "", file: "", fileName: "" }
            : m
        )
      );
    };

    const handleDeletedMe = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    socket.on("message-deleted-everyone", handleDeletedEveryone);
    socket.on("message-deleted-me", handleDeletedMe);

    return () => {
      socket.off("message-deleted-everyone", handleDeletedEveryone);
      socket.off("message-deleted-me", handleDeletedMe);
    };
  }, [socket]);

  /* -------------------- Delete Message: Actions -------------------- */

  const deleteForMe = (messageId) => {
    if (!socket || !user) return;
    socket.emit("delete-message-me", { messageId, requesterId: user.id });
    // Optimistic local removal — server confirmation just double-checks
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    setOpenMenuId(null);
  };

  const deleteForEveryone = (messageId) => {
    if (!socket || !user || !selectedChat) return;
    socket.emit("delete-message-everyone", {
      messageId,
      requesterId: user.id,
      receiverId: selectedChat.clerkId,
    });
    setOpenMenuId(null);
  };

  /* -------------------- Delete Message: Menu Click-Outside -------------------- */

  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-message-menu]")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  /* -------------------- Emoji Picker -------------------- */

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const handleEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const isImageFile = (url) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  const renderTicks = (status) => {
    if (status === "seen") {
      return <span className="text-blue-500">✓✓</span>;
    }
    if (status === "delivered") {
      return <span className="text-gray-400">✓✓</span>;
    }
    return <span className="text-gray-400">✓</span>;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="min-h-[100vh] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] text-white  md:p-10">
      <div className="w-full max-w-7xl mx-auto h-[90dvh] sm:h-[100vh] md:h-[90vh] overflow-hidden md:rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl flex ">

        {/* ---------------- SIDEBAR ---------------- */}
        <div
          className={`
            ${selectedChat ? "hidden lg:flex" : "flex"}
            w-full
            md:w-[40%]
            lg:w-[32%]
            xl:w-[28%]
            2xl:w-[24%]
            flex-col
            border-r
            border-white/10
            bg-black/20
            min-w-0
          
          `}
        >

          {/* Logo */}
          <div className="h-16 sm:h-20  flex items-center justify-between border-b border-white/10 p-8">
            <img
              src="/logo.png"
              alt="logo"
              className="h-10 sm:h-8 object-contain"
            />
            {user ?
              <CgProfile className="lg:hidden w-9 h-9 sm:w-10 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 transition" onClick={() => setShowProfile(true)} />
              : <button
                onClick={() => openSignIn()}
                className="h-[37px] w-[75px] lg:hidden bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition duration-200"
              >
                Login
              </button>
            }
          </div>

          {/* Search */}
          <div className="p-3">
            <input
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full px-4 py-3 rounded-2xl bg-white/10 outline-none text-sm sm:text-base"
            />
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-0">
            {For_Search.map((u, i) => (
              <div
                key={i}
                onClick={() => setSelectedChat(u)}
                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer bg-white/5 hover:bg-white/10 transition"
              >
                <img
                  src={u.image}
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h1 className="font-semibold truncate">{u.name}</h1>
                  <p className="text-xs text-gray-400 truncate">{u.msg}</p>
                </div>

                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline(u.clerkId)
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-500"
                    }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- CHAT AREA ---------------- */}
        <div
          className={`
            ${selectedChat ? "flex" : "hidden lg:flex"}
            flex-1
            min-w-0
            min-h-0
            flex-col
            bg-[#0f172a]/40
          `}
        >
          {/* Header */}
          <div className="h-16 sm:h-20 flex items-center justify-between border-b border-white/10 px-3 sm:px-5 shrink-0">

            {selectedChat ? (
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="lg:hidden text-xl"
                  onClick={() => setSelectedChat(null)}
                >
                  ←
                </button>

                <img
                  src={selectedChat.image}
                  alt={selectedChat.name}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
                />

                <div className="min-w-0">
                  <h1 className="font-semibold truncate">
                    {selectedChat.name}
                  </h1>

                  <p className={`text-xs ${isTyping ? "text-blue-400" : isUserOnline(selectedChat.clerkId) ? "text-green-400" : "text-gray-500"}`}>
                    {isTyping ? "typing..." : isUserOnline(selectedChat.clerkId) ? "Active now" : "Offline"}
                  </p>
                </div>
              </div>
            ) : (
              <h1 className="text-gray-400 text-sm sm:text-base">
                Select a chat
              </h1>
            )}

            <div className="flex gap-2 shrink-0">

              <button
                onClick={startCall}
                disabled={callState !== "idle"}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                📞
              </button>

              <button
                disabled
                title="Video calling coming soon"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 opacity-40 cursor-not-allowed transition"
              >
                🎥
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 min-h-0 hide-scrollbar">
            {selectedChat ? (
              <>
                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  const isMenuOpen = openMenuId === msg._id;
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`
                relative
                max-w-[90%]
                sm:max-w-[80%]
                lg:max-w-[70%]
                px-3
                py-2
                rounded-lg
                shadow-sm
                border
                break-words
                ${isMine
                            ? "bg-[#d9fdd3] border-green-200 rounded-br-sm"
                            : "bg-white border-gray-200 rounded-bl-sm"
                          }
              `}
                      >
                        {/* Kebab menu trigger */}
                        <button
                          data-message-menu
                          onClick={() => setOpenMenuId(isMenuOpen ? null : msg._id)}
                          className="absolute top-0.5 right-1 text-gray-500 hover:text-gray-800 text-sm px-1 leading-none"
                        >
                          ⋮
                        </button>

                        {isMenuOpen && (
                          <div
                            data-message-menu
                            className={`absolute top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg text-xs overflow-hidden min-w-[150px] ${
                              isMine ? "right-1" : "left-1"
                            }`}
                          >
                            <button
                              data-message-menu
                              onClick={() => deleteForMe(msg._id)}
                              className="block w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100"
                            >
                              Delete for me
                            </button>

                            {isMine && !msg.isDeletedForEveryone && (
                              <button
                                data-message-menu
                                onClick={() => deleteForEveryone(msg._id)}
                                className="block w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100 border-t border-gray-100"
                              >
                                Delete for everyone
                              </button>
                            )}
                          </div>
                        )}

                        {msg.isDeletedForEveryone ? (
                          <p className="text-sm text-gray-400 italic pr-14">
                            This message was deleted
                          </p>
                        ) : (
                          <>
                            {msg.text && (
                              <p className="text-sm text-gray-800 pr-14">
                                {msg.text}
                              </p>
                            )}

                            {msg.file && (
                              isImageFile(msg.file) ? (
                                <a href={msg.file} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={msg.file}
                                    alt={msg.fileName || "image"}
                                    className="max-w-[190px] max-h-[190px] rounded-lg mt-2 object-cover cursor-pointer"
                                  />
                                </a>
                              ) : (

                                <a href={msg.file}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-blue-500 underline mt-2"
                                >
                                  {msg.fileName || "Download file"}
                                </a>
                              )
                            )}
                          </>
                        )}

                        <span className="absolute bottom-1 right-2 text-[10px] text-gray-500 flex items-center gap-1">
                          {new Date(
                            msg.createdAt || Date.now()
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {isMine && !msg.isDeletedForEveryone && renderTicks(msg.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg rounded-bl-sm px-3 py-2 shadow-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef}></div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-center px-5">
                Start a conversation
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 sm:p-3 border-t border-white/10 shrink-0 relative">

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full left-2 mb-2 z-20"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  autoFocusSearch={false}
                  theme="dark"
                  height={350}
                  width={300}
                />
              </div>
            )}

            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-3 py-2">

              <button
                ref={emojiButtonRef}
                type="button"
                className="text-lg"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
              >
                😊
              </button>
              <button
                className="text-lg"
                onClick={() => fileInputRef.current.click()}
              >
                📎
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />

              {selectedFile && (
                <div className="px-2 py-1 bg-white/10 rounded-lg text-xs whitespace-nowrap">
                  <img src={URL.createObjectURL(selectedFile)} alt="image" className="h-[40px] w-[40px]" />

                </div>
              )}

              <input
                value={message}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
              />

              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl shrink-0 transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Profile Panel */}
        <div className="hidden md:flex w-[22%] min-w-[280px] border-l border-white/10 bg-black/20 flex-col items-center p-6">

          {user ? (
            <div className="text-center">
              <img
                src={user.imageUrl}
                alt="profile"
                className="w-24 h-24 rounded-full object-cover mx-auto"
              />

              <h2 className="mt-3 font-semibold">
                {user.fullName}
              </h2>

              <p className="text-xs text-gray-400 break-all mt-1">
                {user.primaryEmailAddress?.emailAddress}
              </p>

              <button
                onClick={() => signOut()}
                className="mt-5 px-5 py-2 bg-red-500 rounded-xl hover:bg-red-600 transition"
              >
                Logout
              </button>

              <h1 className="mt-5 text-gray-300 text-sm">
                Build By : Afaq Ahmad Khan
              </h1>
            </div>
          ) : (
            <button
              onClick={() => openSignIn()}
              className="px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 transition"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Profile Modal */}
        {showProfile && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center lg:hidden">
            <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-6 text-center relative">

              <button
                onClick={() => setShowProfile(false)}
                className="absolute top-4 right-4 text-xl text-gray-400 hover:text-white"
              >
                ✕
              </button>

              {user ? (
                <>
                  <img
                    src={user.imageUrl}
                    alt="profile"
                    className="w-24 h-24 rounded-full object-cover mx-auto"
                  />

                  <h2 className="mt-4 text-lg font-semibold">
                    {user.fullName}
                  </h2>

                  <p className="text-sm text-gray-400 break-all mt-2">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>

                  <button
                    onClick={() => {
                      signOut();
                      setShowProfile(false);
                    }}
                    className="mt-6 px-6 py-3 bg-red-500 rounded-xl hover:bg-red-600 transition"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-4">
                    Welcome
                  </h2>

                  <p className="text-gray-400 mb-6">
                    Please login to continue
                  </p>

                  <button
                    onClick={() => {
                      openSignIn();
                      setShowProfile(false);
                    }}
                    className="px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 transition"
                  >
                    Login
                  </button>
                </>
              )}

              <h1 className="mt-8 text-sm text-gray-400">
                Build By : Afaq Ahmad Khan
              </h1>
            </div>
          </div>
        )}

        {/* Hidden element that actually plays the remote audio stream */}
        <audio ref={remoteAudioRef} autoPlay />

        {/* -------------------- Incoming Call (Ringing) -------------------- */}
        {callState === "ringing" && incomingCall && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
              <img
                src={incomingCall.callerImage}
                alt={incomingCall.callerName}
                className="w-24 h-24 rounded-full object-cover mx-auto animate-pulse"
              />

              <h2 className="mt-4 text-lg font-semibold">
                {incomingCall.callerName}
              </h2>

              <p className="text-sm text-gray-400 mt-1">Incoming call...</p>

              <div className="flex justify-center gap-6 mt-8">
                <button
                  onClick={rejectCall}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 transition flex items-center justify-center text-2xl"
                  title="Decline"
                >
                  ✕
                </button>

                <button
                  onClick={acceptCall}
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 transition flex items-center justify-center text-2xl"
                  title="Accept"
                >
                  📞
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- Outgoing Call (Calling...) -------------------- */}
        {callState === "calling" && activeCallPartner && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
              <img
                src={activeCallPartner.image}
                alt={activeCallPartner.name}
                className="w-24 h-24 rounded-full object-cover mx-auto animate-pulse"
              />

              <h2 className="mt-4 text-lg font-semibold">
                {activeCallPartner.name}
              </h2>

              <p className="text-sm text-gray-400 mt-1">Calling...</p>

              <div className="flex justify-center mt-8">
                <button
                  onClick={endCall}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 transition flex items-center justify-center text-2xl"
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- Connected Call -------------------- */}
        {callState === "connected" && activeCallPartner && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
              <img
                src={activeCallPartner.image}
                alt={activeCallPartner.name}
                className="w-24 h-24 rounded-full object-cover mx-auto"
              />

              <h2 className="mt-4 text-lg font-semibold">
                {activeCallPartner.name}
              </h2>

              <p className="text-sm text-green-400 mt-1">
                {formatDuration(callDuration)}
              </p>

              <div className="flex justify-center gap-6 mt-8">
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full transition flex items-center justify-center text-2xl ${
                    isMuted ? "bg-yellow-500 hover:bg-yellow-600" : "bg-white/10 hover:bg-white/20"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? "🔇" : "🎙️"}
                </button>

                <button
                  onClick={endCall}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 transition flex items-center justify-center text-2xl"
                  title="End call"
                >
                  📴
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home_page;