import React, { useState, useEffect, useRef } from "react";

function VideoCard({ username, stream, isLocal = false }) {
  const videoRef = useRef(null);
  const [orientation, setOrientation] = useState(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;

    videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
      const video = videoRef.current;
      if (!video || !stream) return;
  
      const checkOrientation = () => {
        const { videoWidth, videoHeight } = video;
  
        if (!videoWidth || !videoHeight) return;
  
        setOrientation(
          videoHeight > videoWidth ? "vertical" : "horizontal"
        );
      };
  
      video.addEventListener("loadedmetadata", checkOrientation);
  
      if (video.readyState >= 1) {
        checkOrientation();
      }
  
      return () => {
        video.removeEventListener("loadedmetadata", checkOrientation);
      };
    }, [stream]);

  const hasVideo = stream?.getVideoTracks().some((track) => track.enabled);

  return (
    <>
      <div className="relative w-full h-full min-w-0 min-h-0 overflow-hidden rounded">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`absolute inset-0 w-full h-full block ${orientation === "vertical" ? "object-contain" : "object-cover"} object-contain object-center`}
          style={{
            background: "#222",
            display: hasVideo ? "block" : "none",
          }}
        />

        {
          !hasVideo &&
          <div className="relative w-full h-full min-w-0 min-h-0 overflow-hidden bg-black flex justify-center items-center text-3xl rounded">
            <div className='bg-gray-300 rounded-full w-20 h-20 text-center flex justify-center items-center text-4xl'>{username[0]?.toUpperCase()}</div>
          </div>
        }
        
        <p className="absolute bottom-2 left-4 text-white">{username}</p>
      </div>
    </>
  );
}

export default VideoCard;