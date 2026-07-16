import MessageBubble from "./MessageBubble";

const MessagesList = ({
  selectedChat,
  messages,
  user,
  isTyping,
  openMenuId,
  setOpenMenuId,
  deleteForMe,
  deleteForEveryone,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 min-h-0 hide-scrollbar">
      {selectedChat ? (
        <>
          {messages.map((msg) => {
            const isMine = msg.senderId === user?.id;
            const isMenuOpen = openMenuId === msg._id;
            return (
              <MessageBubble
                key={msg._id}
                msg={msg}
                isMine={isMine}
                isMenuOpen={isMenuOpen}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                deleteForMe={deleteForMe}
                deleteForEveryone={deleteForEveryone}
              />
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
  );
};

export default MessagesList;