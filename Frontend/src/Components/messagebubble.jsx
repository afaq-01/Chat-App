import { renderTicks } from "./TickIcons";

const isImageFile = (url) => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
};

const MessageBubble = ({ msg, isMine, isMenuOpen, openMenuId, setOpenMenuId, deleteForMe, deleteForEveryone }) => {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          relative
          max-w-[90%]
          sm:max-w-[90%]
          h-[45px]
          lg:max-w-[70%]
          px-2
          py-2
          rounded-lg
          shadow-sm
          border
          break-words
          ${isMine ? "bg-[#d9fdd3] border-green-200 rounded-br-sm" : "bg-white border-gray-200 rounded-bl-sm"}
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
          <p className="text-sm text-gray-400 italic pr-14">This message was deleted</p>
        ) : (
          <>
            {msg.text && <p className="text-sm text-gray-800 pr-14 ">{msg.text}</p>}

            {msg.file &&
              (isImageFile(msg.file) ? (
                <a href={msg.file} target="_blank" rel="noopener noreferrer">
                  <img
                    src={msg.file}
                    alt={msg.fileName || "image"}
                    className="max-w-[190px] max-h-[190px] rounded-lg mt-2 object-cover cursor-pointer"
                  />
                </a>
              ) : (
                <a
                  href={msg.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-500 underline mt-2"
                >
                  {msg.fileName || "Download file"}
                </a>
              ))}
          </>
        )}

        <span className="absolute bottom-1 right-2 text-[10px] text-gray-500 flex items-center gap-1">
          {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isMine && !msg.isDeletedForEveryone && renderTicks(msg.status)}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;