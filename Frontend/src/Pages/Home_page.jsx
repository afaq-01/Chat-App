import { useContext, useState, useEffect, useRef } from "react";
import Context from "../Components/Context";
import { useUser, useClerk } from "@clerk/clerk-react";
import axios from "axios";

import Sidebar from "../Components/sidebar";
import ChatHeader from "../Components/chatheader";
import MessagesList from "../Components/messageList";
import MessageInput from "../Components/messageInput";
import ProfilePanel from "../Components/profilePanel";
import ProfileModal from "../Components/profileModel";
import { IncomingCallModal, OutgoingCallModal, ConnectedCallModal } from "../Components/calloverlays";

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
        prev.map((m) => (m.senderId === user?.id && m.receiverId === seenBy ? { ...m, status: "seen" } : m))
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
    setIsTyping(false);
    markConversationSeen(selectedChat.clerkId);
  }, [selectedChat, user, isLoaded]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);

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
    const partnerId = currentCallPartnerRef.current || incomingCall?.from || activeCallPartner?.clerkId;

    if (partnerId) {
      socket.emit("end-call", { to: partnerId, from: user.id });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
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
        prev.map((m) => (m._id === messageId ? { ...m, isDeletedForEveryone: true, text: "", file: "", fileName: "" } : m))
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="min-h-[100vh] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] text-white  md:p-10">
      <div className="w-full max-w-7xl mx-auto h-[90dvh] sm:h-[100vh] md:h-[90vh] overflow-hidden md:rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl flex ">

        <Sidebar
          selectedChat={selectedChat}
          user={user}
          openSignIn={openSignIn}
          setShowProfile={setShowProfile}
          setSearch={setSearch}
          For_Search={For_Search}
          setSelectedChat={setSelectedChat}
          isUserOnline={isUserOnline}
        />

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
          <ChatHeader
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            isTyping={isTyping}
            isUserOnline={isUserOnline}
            startCall={startCall}
            callState={callState}
          />

          <MessagesList
            selectedChat={selectedChat}
            messages={messages}
            user={user}
            isTyping={isTyping}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            deleteForMe={deleteForMe}
            deleteForEveryone={deleteForEveryone}
            messagesEndRef={messagesEndRef}
          />

          <MessageInput
            message={message}
            handleTyping={handleTyping}
            sendMessage={sendMessage}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileInputRef={fileInputRef}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            emojiPickerRef={emojiPickerRef}
            emojiButtonRef={emojiButtonRef}
            handleEmojiClick={handleEmojiClick}
          />
        </div>

        <ProfilePanel user={user} openSignIn={openSignIn} signOut={signOut} />

        <ProfileModal
          showProfile={showProfile}
          setShowProfile={setShowProfile}
          user={user}
          openSignIn={openSignIn}
          signOut={signOut}
        />

        {/* Hidden element that actually plays the remote audio stream */}
        <audio ref={remoteAudioRef} autoPlay />

        {callState === "ringing" && (
          <IncomingCallModal incomingCall={incomingCall} acceptCall={acceptCall} rejectCall={rejectCall} />
        )}

        {callState === "calling" && <OutgoingCallModal activeCallPartner={activeCallPartner} endCall={endCall} />}

        {callState === "connected" && (
          <ConnectedCallModal
            activeCallPartner={activeCallPartner}
            callDuration={callDuration}
            isMuted={isMuted}
            toggleMute={toggleMute}
            endCall={endCall}
            formatDuration={formatDuration}
          />
        )}
      </div>
    </div>
  );
};

export default Home_page;