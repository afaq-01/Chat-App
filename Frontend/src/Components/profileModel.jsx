const ProfileModal = ({ showProfile, setShowProfile, user, openSignIn, signOut }) => {
  if (!showProfile) return null;

  return (
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
            <img src={user.imageUrl} alt="profile" className="w-24 h-24 rounded-full object-cover mx-auto" />

            <h2 className="mt-4 text-lg font-semibold">{user.fullName}</h2>

            <p className="text-sm text-gray-400 break-all mt-2">{user.primaryEmailAddress?.emailAddress}</p>

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
            <h2 className="text-xl font-semibold mb-4">Welcome</h2>

            <p className="text-gray-400 mb-6">Please login to continue</p>

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

        <h1 className="mt-8 text-sm text-gray-400">Build By : Afaq Ahmad Khan</h1>
      </div>
    </div>
  );
};

export default ProfileModal;