/* -------------------- Tick Icons -------------------- */
/*
  Small reusable SVG checkmarks for message status.
*/

export const SingleTick = ({ className = "" }) => (
  <svg
    viewBox="0 0 16 15"
    width="14"
    height="13"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.51z"
      fill="currentColor"
    />
  </svg>
);

export const DoubleTick = ({ className = "" }) => (
  <svg
    viewBox="0 0 20 15"
    width="18"
    height="13"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.51z"
      fill="currentColor"
    />
    <path
      d="M11.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.666 9.879a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.51z"
      fill="currentColor"
    />
  </svg>
);

export const renderTicks = (status) => {
  if (status === "seen") {
    return <DoubleTick className="text-blue-500 inline-block align-middle" />;
  }
  if (status === "delivered") {
    return <DoubleTick className="text-gray-400 inline-block align-middle" />;
  }
  return <SingleTick className="text-gray-400 inline-block align-middle" />;
};