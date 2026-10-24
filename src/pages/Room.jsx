import React, { useContext, useRef, useEffect, useState } from 'react';
import UserContext from '../contexts/UserContext';
import MicContext from '../contexts/MicContext';
import CameraContext from '../contexts/CameraContext';
import MyStreamContext from '../contexts/MyStreamContext';
import { IoMdMic } from "react-icons/io";
import { IoMdMicOff } from "react-icons/io";
import { BsCameraVideoFill } from "react-icons/bs";
import { BsCameraVideoOffFill } from "react-icons/bs";
import { MdCallEnd } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { LuScreenShare } from "react-icons/lu";
import SocketContext from '../contexts/SocketContext';
import VideoCard from '../components/VideoCard';
import { joinConference, leaveConference } from "../modules/sfu";

function Room() {

  const { username, setUsername } = useContext(UserContext);
  const { isMicOn, setIsMicOn } = useContext(MicContext);
  const { isCameraOn, setIsCameraOn } = useContext(CameraContext);
  const { myStream, setMyStream } = useContext(MyStreamContext);

  const [remoteTracks, setRemoteTracks] = useState([]);
  const [connectionError, setConnectionError] = useState("");

  const navigate = useNavigate();

  const socket = useContext(SocketContext);

  const videoRef = useRef(null);

  let stream;

  // if username is not there redirect to /lobby
  useEffect(() => {
    if (!username) {
      navigate('/lobby');
    }
  }, []);

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setMyStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Apply the current mic and camera settings
      stream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });

    } catch (error) {
      console.error("Camera or microphone access failed:", error);
    }
  }

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = myStream;
    }
    if (myStream) {
      myStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });
    }
  }, [myStream, isCameraOn, isMicOn]);

  const handleMicToggle = () => {
    setIsMicOn(!isMicOn);
  }

  const handleCameraToggle = () => {
    const newState = !isCameraOn;
    setIsCameraOn(newState);

    // Toggle the existing camera track instead of
    // creating a new MediaStream.
    myStream?.getVideoTracks().forEach((track) => {
      track.enabled = newState;
    });
  };

  const handleCallEnd = () => {
    navigate('/');
  }

  useEffect(() => {
    if (!myStream) return;

    let mounted = true;

    async function startCall() {
      try {
        await joinConference({
          username,
          localStream: myStream,

          // Called whenever a remote audio/video track is consumed.
          onRemoteTrack: ({ peerId, username, track }) => {
            if (!mounted) return;

            setRemoteTracks((previous) => {
              const existing = previous.find(
                (participant) => participant.peerId === peerId
              );

              if (existing) {
                // Add this participant's audio/video track to their stream.
                existing.stream.addTrack(track);

                return previous.map((participant) =>
                  participant.peerId === peerId
                    ? { ...participant, stream: existing.stream }
                    : participant
                );
              }

              return [
                ...previous,
                {
                  peerId,
                  username: username || "Participant",
                  stream: new MediaStream([track]),
                },
              ];
            });
          },

          // Called when a remote track/consumer closes.
          onRemoteTrackClosed: ({ peerId, track }) => {
            if (!mounted) return;

            setRemoteTracks((previous) =>
              previous
                .map((participant) => {
                  if (participant.peerId !== peerId) {
                    return participant;
                  }

                  const remainingTracks =
                    participant.stream
                      .getTracks()
                      .filter((item) => item.id !== track?.id);

                  return {
                    ...participant,
                    stream: new MediaStream(remainingTracks),
                  };
                })
                .filter(
                  (participant) =>
                    participant.stream.getTracks().length > 0
                )
            );
          },

          // Called when a participant leaves the room.
          onPeerLeft: ({ peerId }) => {
            if (!mounted) return;

            setRemoteTracks((previous) =>
              previous.filter(
                (participant) => participant.peerId !== peerId
              )
            );
          },
        });
      } catch (error) {
        console.error("Unable to join conference:", error);
        if (mounted) {
          setConnectionError("Unable to connect to the conference.");
        }
      }
    }

    startCall();

    return () => {
      mounted = false;
      leaveConference();
    };
  }, [username, myStream]);

  return (
    <div className='w-screen h-screen flex flex-col bg-gray-900'>
      <div className='grow relative p-2 bg-blue-950'>
        <div className='w-full h-full grid grid-cols-3 gap-2'>
          {remoteTracks.map((participant) => (
            <VideoCard
              key={participant.peerId}
              username={participant.username}
              stream={participant.stream}
            />
          ))}
        </div>
        <div className='w-64 h-36 absolute bottom-2 right-2 rounded'>
          {
            isCameraOn ?
              <video ref={videoRef} autoPlay muted className='w-full h-full object-cover rounded'></video> :
              <div className='w-full h-full bg-gray-500 flex justify-center items-center text-3xl rounded'><div className='bg-gray-300 rounded-full w-20 h-20 text-center flex justify-center items-center text-4xl'>{username[0]?.toUpperCase()}</div></div>
          }
          <div className='absolute bottom-2 left-2 flex items-center text-white'>
            {isMicOn ? <></> : <IoMdMicOff className='text-red-500' />}
            <p>{username}</p>
          </div>
        </div>
      </div>
      <div className='w-full h-16 flex justify-center my-2'>
        <div className='flex justify-center gap-5 bg-gray-300 p-3 rounded'>
          <button className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' onClick={handleMicToggle}>{!isMicOn ? <IoMdMicOff /> : <IoMdMic />}</button>
          <button className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' onClick={handleCameraToggle}>{!isCameraOn ? <BsCameraVideoOffFill /> : <BsCameraVideoFill />}</button>
          <button className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' ><LuScreenShare /></button>
          <button className='text-2xl p-2 bg-red-500 text-white rounded hover:cursor-pointer hover:bg-red-900' onClick={handleCallEnd}><MdCallEnd /></button>
        </div>
      </div>
    </div>
  )
}

export default Room;