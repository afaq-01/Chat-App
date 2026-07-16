const ProfilePanel = ({ user, openSignIn, signOut }) => {
  return (
    <div className="hidden md:flex w-[22%] min-w-[280px] border-l border-white/10 bg-black/20 flex-col items-center p-6">
      {user ? (
        <div className="text-center">
          <img src={user.imageUrl} alt="profile" className="w-24 h-24 rounded-full object-cover mx-auto" />

          <h2 className="mt-3 font-semibold">{user.fullName}</h2>

          <p className="text-xs text-gray-400 break-all mt-1">{user.primaryEmailAddress?.emailAddress}</p>

          <button onClick={() => signOut()} className="mt-5 px-5 py-2 bg-red-500 rounded-xl hover:bg-red-600 transition">
            Logout
          </button>

          <h1 className="mt-5 text-gray-300 text-sm">Build By : Afaq Ahmad Khan</h1>
        </div>
      ) : (
        <button onClick={() => openSignIn()} className="px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 transition">
          Login
        </button>
      )}
    </div>
  );
};

export default ProfilePanel;