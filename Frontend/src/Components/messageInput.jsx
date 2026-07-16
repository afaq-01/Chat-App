import EmojiPicker from "emoji-picker-react";

const MessageInput = ({
  message,
  handleTyping,
  sendMessage,
  selectedFile,
  setSelectedFile,
  fileInputRef,
  showEmojiPicker,
  setShowEmojiPicker,
  emojiPickerRef,
  emojiButtonRef,
  handleEmojiClick,
}) => {
  return (
    <div className="p-2 sm:p-3 border-t border-white/10 shrink-0 relative">
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-full left-2 mb-2 z-20">
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
        <button className="text-lg" onClick={() => fileInputRef.current.click()}>
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
  );
};

export default MessageInput;