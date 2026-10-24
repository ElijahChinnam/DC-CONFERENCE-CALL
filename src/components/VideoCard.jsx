import React, { useEffect, useRef } from "react";

function VideoCard({ username, stream, isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;

    videoRef.current.srcObject = stream;
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some((track) => track.enabled);

  return (
    <div className="video-card">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: "100%",
          background: "#222",
          display: hasVideo ? "block" : "none",
        }}
      />

      {!hasVideo && <div>{username} — Camera off</div>}

      <p>{username}</p>
    </div>
  );
}

export default VideoCard;