import { CgProfile } from "react-icons/cg";

const Sidebar = ({
  selectedChat,
  user,
  openSignIn,
  setShowProfile,
  setSearch,
  For_Search,
  setSelectedChat,
  isUserOnline,
}) => {
  return (
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
        <img src="/logo.png" alt="logo" className="h-10 sm:h-8 object-contain" />
        {user ? (
          <CgProfile
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 transition"
            onClick={() => setShowProfile(true)}
          />
        ) : (
          <button
            onClick={() => openSignIn()}
            className="h-[37px] w-[75px] lg:hidden bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition duration-200"
          >
            Login
          </button>
        )}
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
            <img src={u.image} alt={u.name} className="w-12 h-12 rounded-full object-cover shrink-0" />

            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">{u.name}</h1>
              <p className="text-xs text-gray-400 truncate">{u.msg}</p>
            </div>

            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isUserOnline(u.clerkId) ? "bg-green-500 animate-pulse" : "bg-gray-500"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;