import { useContext, useState, useEffect, useRef } from "react";
import Context from "../Components/Context";
import { useUser, useClerk } from "@clerk/clerk-react";
import { CgProfile } from "react-icons/cg";
import axios from "axios";

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
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

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
  }, [selectedChat, user, isLoaded]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("receive-message", handleMessage);

    return () => {
      socket.off("receive-message", handleMessage);
    };
  }, [socket]);

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

      setMessage("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Send message failed:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const isImageFile = (url) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
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
                  className={`w-2 h-2 rounded-full shrink-0 ${u.online
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

                  <p className="text-xs text-green-400">
                    Active now
                  </p>
                </div>
              </div>
            ) : (
              <h1 className="text-gray-400 text-sm sm:text-base">
                Select a chat
              </h1>
            )}

            <div className="flex gap-2 shrink-0">

              <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 transition">
                📞
              </button>

              <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 transition">
                🎥
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 min-h-0 hide-scrollbar">
            {selectedChat ? (
              <>
                {messages.map((msg, index) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={index}
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


                        <span className="absolute bottom-1 right-2 text-[10px] text-gray-500">
                          {new Date(
                            msg.createdAt || Date.now()
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef}></div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-center px-5">
                Start a conversation
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 sm:p-3 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-3 py-2">

              <button className="text-lg">😊</button>
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
                onChange={(e) => setMessage(e.target.value)}
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
      </div>
    </div>
  );
};

export default Home_page;
