const ChatHeader = ({ selectedChat, setSelectedChat, isTyping, isUserOnline, startCall, callState }) => {
  return (
    <div className="h-16 sm:h-20 flex items-center justify-between border-b border-white/10 px-3 sm:px-5 shrink-0">
      {selectedChat ? (
        <div className="flex items-center gap-3 min-w-0">
          <button className="lg:hidden text-xl" onClick={() => setSelectedChat(null)}>
            ←
          </button>

          <img
            src={selectedChat.image}
            alt={selectedChat.name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
          />

          <div className="min-w-0">
            <h1 className="font-semibold truncate">{selectedChat.name}</h1>

            <p
              className={`text-xs ${
                isTyping
                  ? "text-blue-400"
                  : isUserOnline(selectedChat.clerkId)
                  ? "text-green-400"
                  : "text-gray-500"
              }`}
            >
              {isTyping ? "typing..." : isUserOnline(selectedChat.clerkId) ? "Active now" : "Offline"}
            </p>
          </div>
        </div>
      ) : (
        <h1 className="text-gray-400 text-sm sm:text-base">Select a chat</h1>
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
  );
};

export default ChatHeader;