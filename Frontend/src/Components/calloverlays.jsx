export const IncomingCallModal = ({ incomingCall, acceptCall, rejectCall }) => {
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
        <img
          src={incomingCall.callerImage}
          alt={incomingCall.callerName}
          className="w-24 h-24 rounded-full object-cover mx-auto animate-pulse"
        />

        <h2 className="mt-4 text-lg font-semibold">{incomingCall.callerName}</h2>

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
  );
};

export const OutgoingCallModal = ({ activeCallPartner, endCall }) => {
  if (!activeCallPartner) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
        <img
          src={activeCallPartner.image}
          alt={activeCallPartner.name}
          className="w-24 h-24 rounded-full object-cover mx-auto animate-pulse"
        />

        <h2 className="mt-4 text-lg font-semibold">{activeCallPartner.name}</h2>

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
  );
};

export const ConnectedCallModal = ({ activeCallPartner, callDuration, isMuted, toggleMute, endCall, formatDuration }) => {
  if (!activeCallPartner) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[90%] max-w-sm bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
        <img src={activeCallPartner.image} alt={activeCallPartner.name} className="w-24 h-24 rounded-full object-cover mx-auto" />

        <h2 className="mt-4 text-lg font-semibold">{activeCallPartner.name}</h2>

        <p className="text-sm text-green-400 mt-1">{formatDuration(callDuration)}</p>

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
  );
};