import React, { useContext, useRef, useEffect, useState } from 'react';
import UserContext from '../contexts/UserContext';
import MicContext from '../contexts/MicContext';
import CameraContext from '../contexts/CameraContext';
import MyStreamContext from '../contexts/MyStreamContext';
import { IoMdMic } from "react-icons/io";
import { IoMdMicOff } from "react-icons/io";
import { BsCameraVideoFill } from "react-icons/bs";
import { BsCameraVideoOffFill } from "react-icons/bs";
import { IoMdSettings } from "react-icons/io";
import { MdCallEnd } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { LuScreenShare } from "react-icons/lu";
import { FaUserCog } from "react-icons/fa";
import SocketContext from '../contexts/SocketContext';
import VideoCard from '../components/VideoCard';
import {
  joinConference,
  leaveConference,
  replaceLocalTrack,
} from "../modules/sfu";
import HostContext from '../contexts/HostContext';

function Room() {

  const { username, setUsername } = useContext(UserContext);
  const { isMicOn, setIsMicOn } = useContext(MicContext);
  const { isCameraOn, setIsCameraOn } = useContext(CameraContext);
  const { myStream, setMyStream } = useContext(MyStreamContext);
  const { isHost, setIsHost } = useContext(HostContext);

  const [remoteTracks, setRemoteTracks] = useState([]);
  const [connectionError, setConnectionError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);

  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const [deviceError, setDeviceError] = useState("");

  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);

  const [allowJoin, setAllowJoin] = useState(false);
  const [allowVideo, setAllowVideo] = useState(false);
  const [allowAudio, setAllowAudio] = useState(false);
  const [allowScreenShare, setAllowScreenShare] = useState(false);

  const [gridCols, setGridCols] = useState([1, 1, 2, 2, 2, 3, 3, 3, 4, 3, 4]);
  const [gridRows, setGridRows] = useState([1, 1, 1, 2, 2, 2, 2, 3, 2, 3, 3]);

  const [gridMobileCols, setMobileGridCols] = useState([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
  const [gridMobileRows, setMobileGridRows] = useState([1, 1, 2, 3, 4, 3, 3, 4, 4, 4, 4]);

  const index = Math.min(remoteTracks.length, gridCols.length - 1);

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

  // Load available camera, microphone, and speaker devices
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
    } catch (error) {
      console.error("Could not load devices:", error);
    }
  };

  useEffect(() => {
    let active = true;

    const loadDevices = async () => {
      try {
        await refreshDevices();

        if (!active) return;

        const devices = await navigator.mediaDevices.enumerateDevices();

        setSelectedCameraId(
          myStream?.getVideoTracks()[0]?.getSettings().deviceId ||
          devices.find((d) => d.kind === "videoinput")?.deviceId ||
          ""
        );

        setSelectedMicId(
          myStream?.getAudioTracks()[0]?.getSettings().deviceId ||
          devices.find((d) => d.kind === "audioinput")?.deviceId ||
          ""
        );

        const savedSpeaker = localStorage.getItem("speakerDeviceId");
        const validSpeaker = devices.find(
          (d) => d.kind === "audiooutput" && d.deviceId === savedSpeaker
        );

        setSelectedSpeakerId(
          validSpeaker?.deviceId ||
          devices.find((d) => d.kind === "audiooutput")?.deviceId ||
          ""
        );
      } catch (error) {
        console.error("Device loading failed:", error);
      }
    };

    loadDevices();

    return () => {
      active = false;
    };
  }, [myStream]);

  // Switch microphone
  const handleMicChange = async (deviceId) => {
    let newStream;

    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];

      if (!newTrack) {
        throw new Error("No microphone track was created.");
      }

      newTrack.enabled = isMicOn;

      // Update the mediasoup producer as well as the local stream
      await replaceLocalTrack("audio", newTrack);

      const updatedStream = new MediaStream([
        ...(myStream?.getVideoTracks() || []),
        newTrack,
      ]);

      myStream?.getAudioTracks().forEach((track) => track.stop());

      setMyStream(updatedStream);
      setSelectedMicId(deviceId);
      setDeviceError("");
      await refreshDevices();
    } catch (error) {
      newStream?.getTracks().forEach((track) => track.stop());
      console.error("Microphone switch failed:", error);
      setDeviceError("Could not switch microphone. Check its permissions.");
    }
  };

  // Switch camera
  const handleCameraChange = async (deviceId) => {
    let newStream;

    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];

      if (!newTrack) {
        throw new Error("No camera track was created.");
      }

      newTrack.enabled = isCameraOn;

      // Update the mediasoup producer as well as the local stream
      await replaceLocalTrack("video", newTrack);

      const updatedStream = new MediaStream([
        newTrack,
        ...(myStream?.getAudioTracks() || []),
      ]);

      myStream?.getVideoTracks().forEach((track) => track.stop());

      setMyStream(updatedStream);
      setSelectedCameraId(deviceId);
      setDeviceError("");
      await refreshDevices();
    } catch (error) {
      newStream?.getTracks().forEach((track) => track.stop());
      console.error("Camera switch failed:", error);
      setDeviceError("Could not switch camera. Check its permissions.");
    }
  };

  // Switch speaker output
  const handleSpeakerChange = async (deviceId) => {
    try {
      const mediaElements = document.querySelectorAll("video, audio");

      for (const element of mediaElements) {
        if (typeof element.setSinkId === "function") {
          await element.setSinkId(deviceId);
        }
      }

      setSelectedSpeakerId(deviceId);
      localStorage.setItem("speakerDeviceId", deviceId);
      setDeviceError("");
    } catch (error) {
      console.error("Speaker switch failed:", error);
      setDeviceError("Could not switch speaker on this browser.");
    }
  };

  return (
    <div className='w-dvw h-dvh flex flex-col bg-gray-900'>
      <div className='flex-1 min-h-0 min-w-0 relative p-2 md:px-30 bg-blue-950'>
        <div className="w-full h-full relative min-h-0 min-w-0 overflow-hidden grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${window.innerWidth < 640
              ? gridMobileCols[index + 1]
              : gridCols[index + 1]
              }, minmax(0, 1fr))`,

            gridTemplateRows: `repeat(${window.innerWidth < 640
              ? gridMobileRows[index + 1]
              : gridRows[index + 1]
              }, minmax(0, 1fr))`,
          }}
        >
          {remoteTracks.map((participant) => (
            <VideoCard
              key={participant.peerId}
              username={participant.username}
              stream={participant.stream}
            />
          ))}
          <VideoCard
            key={"local"}
            username={username}
            stream={myStream}
            isLocal={true}
          />
        </div>
        {/* <div className='w-64 h-36 absolute bottom-2 right-2 rounded'>
          {
            isCameraOn ?
              <video ref={videoRef} autoPlay muted className='w-full h-full object-cover rounded'></video> :
              <div className='w-full h-full bg-gray-500 flex justify-center items-center text-3xl rounded'><div className='bg-gray-300 rounded-full w-20 h-20 text-center flex justify-center items-center text-4xl'>{username[0]?.toUpperCase()}</div></div>
          }
          <div className='absolute bottom-2 left-2 flex items-center text-white'>
            {isMicOn ? <></> : <IoMdMicOff className='text-red-500' />}
            <p>{username}</p>
          </div>
        </div> */}
      </div>
      <div className='w-full h-16 flex justify-center my-2'>
        <div className='flex justify-center gap-5 bg-gray-300 p-3 rounded'>
          <button title="Microphone" className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' onClick={handleMicToggle}>{!isMicOn ? <IoMdMicOff /> : <IoMdMic />}</button>
          <button title="Camera" className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' onClick={handleCameraToggle}>{!isCameraOn ? <BsCameraVideoOffFill /> : <BsCameraVideoFill />}</button>
          <button title="Presentation" className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' ><LuScreenShare /></button>
          <button type="button" title="Settings" onClick={() => setIsSettingsOpen(true)} className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' ><IoMdSettings /></button>
          {
            isHost && <button type="button" title="Host Controls" onClick={() => setIsHostControlsOpen(true)} className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer hover:bg-blue-950' ><FaUserCog /></button>
          }
          <button title="End Call" className='text-2xl p-2 bg-red-500 text-white rounded hover:cursor-pointer hover:bg-red-900' onClick={handleCallEnd}><MdCallEnd /></button>
          {isSettingsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsSettingsOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h2
                    id="settings-title"
                    className="text-xl font-semibold text-gray-900"
                  >
                    Device Settings
                  </h2>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    aria-label="Close settings"
                    className="rounded px-3 py-1 text-2xl text-gray-600 hover:bg-gray-100"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Camera input */}
                  <div>
                    <label className="mb-2 block font-medium text-gray-800">
                      Camera Input
                    </label>

                    <select
                      value={selectedCameraId}
                      onChange={(event) => handleCameraChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-600"
                    >
                      {videoInputs.length === 0 && (
                        <option value="">No cameras found</option>
                      )}

                      {videoInputs.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Microphone input */}
                  <div>
                    <label className="mb-2 block font-medium text-gray-800">
                      Audio Input (Microphone)
                    </label>

                    <select
                      value={selectedMicId}
                      onChange={(event) => handleMicChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-600"
                    >
                      {audioInputs.length === 0 && (
                        <option value="">No microphones found</option>
                      )}

                      {audioInputs.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaker output */}
                  <div>
                    <label className="mb-2 block font-medium text-gray-800">
                      Audio Output (Speaker)
                    </label>

                    <select
                      value={selectedSpeakerId}
                      onChange={(event) => handleSpeakerChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-600"
                    >
                      {audioOutputs.length === 0 && (
                        <option value="">No speakers found</option>
                      )}

                      {audioOutputs.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Speaker ${index + 1}`}
                        </option>
                      ))}
                    </select>

                    <p className="mt-1 text-xs text-gray-500">
                      Speaker selection depends on browser support.
                    </p>
                  </div>

                  {deviceError && (
                    <p role="alert" className="text-sm text-red-600">
                      {deviceError}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="mt-6 w-full rounded-lg bg-blue-900 px-4 py-3 font-medium text-white hover:bg-blue-950"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {isHostControlsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsHostControlsOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="host-controls-title"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <h2
                    id="host-controls-title"
                    className="text-xl font-semibold text-gray-900"
                  >
                    Host Controls
                  </h2>

                  <button
                    type="button"
                    onClick={() => setIsHostControlsOpen(false)}
                    aria-label="Close host controls"
                    className="rounded px-3 py-1 text-2xl text-gray-600 hover:bg-gray-100"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-5">

                  {/* Allow Join */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="font-medium text-gray-800">
                      Allow other users to join
                    </label>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowJoin}
                      onClick={() => setAllowJoin(!allowJoin)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${allowJoin ? "bg-blue-900" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${allowJoin ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Allow Video */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="font-medium text-gray-800">
                      Allow other users to turn on their video
                    </label>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowVideo}
                      onClick={() => setAllowVideo(!allowVideo)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${allowVideo ? "bg-blue-900" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${allowVideo ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Allow Audio */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="font-medium text-gray-800">
                      Allow other users to turn on their audio
                    </label>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowAudio}
                      onClick={() => setAllowAudio(!allowAudio)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${allowAudio ? "bg-blue-900" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${allowAudio ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Allow Screen Share */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="font-medium text-gray-800">
                      Allow other users to present their screen
                    </label>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowScreenShare}
                      onClick={() => setAllowScreenShare(!allowScreenShare)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${allowScreenShare ? "bg-blue-900" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${allowScreenShare ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                </div>

                {/* Done Button */}
                <button
                  type="button"
                  onClick={() => setIsHostControlsOpen(false)}
                  className="mt-6 w-full rounded-lg bg-blue-900 px-4 py-3 font-medium text-white hover:bg-blue-950"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Room;  