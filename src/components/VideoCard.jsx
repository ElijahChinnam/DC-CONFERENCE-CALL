import React, { useEffect, useRef } from "react";

function VideoCard({ username, stream, isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;

    videoRef.current.srcObject = stream;
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some((track) => track.enabled);

  return (
    <>
      <div className="relative w-full h-full min-w-0 min-h-0 overflow-hidden ">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full block object-cover"
          style={{
            background: "#222",
            display: hasVideo ? "block" : "none",
          }}
        />

        {!hasVideo && <div>{username} — Camera off</div>}

        <p className="absolute bottom-2 left-4 text-white">{username}</p>
      </div>
    </>
  );
}

export default VideoCard;