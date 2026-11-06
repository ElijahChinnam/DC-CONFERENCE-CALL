import React, { useContext, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserContext from '../contexts/UserContext';
import MicContext from '../contexts/MicContext';
import CameraContext from '../contexts/CameraContext';
import MyStreamContext from '../contexts/MyStreamContext';
import HostContext from '../contexts/HostContext';
import { IoMdMic } from "react-icons/io";
import { IoMdMicOff } from "react-icons/io";
import { BsCameraVideoFill } from "react-icons/bs";
import { BsCameraVideoOffFill } from "react-icons/bs";
import { IoIosArrowUp } from "react-icons/io";
import { isMobile, isTablet, isDesktop, deviceType } from "react-device-detect";
import bcrypt from 'bcryptjs';

function Lobby() {

  const navigate = useNavigate();

  const { username, setUsername } = useContext(UserContext);
  const { isMicOn, setIsMicOn } = useContext(MicContext);
  const { isCameraOn, setIsCameraOn } = useContext(CameraContext);
  const { myStream, setMyStream } = useContext(MyStreamContext);
  const { isHost, setIsHost } = useContext(HostContext);
  const [rememberName, setRememberName] = useState(true);
  const [orientation, setOrientation] = useState(null);
  const [isMicOptionsOpen, setIsMicOptionsOpen] = useState(false);
  const [isCamOptionsOpen, setIsCamOptionsOpen] = useState(false);
  const [isHostPasswordOpen, setIsHostPasswordOpen] = useState(false);
  const [hostPassword, setHostPassword] = useState("");
  const [hostPasswordError, setHostPasswordError] = useState("");
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);

  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const [deviceError, setDeviceError] = useState("");

  const micDropdownRef = useRef(null);
  const camDropdownRef = useRef(null);

  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function initializeDevices() {
      try {
        // Request permission so browsers can reveal device labels.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setMyStream(stream);

        stream.getVideoTracks().forEach((track) => {
          track.enabled = isCameraOn;
        });

        stream.getAudioTracks().forEach((track) => {
          track.enabled = isMicOn;
        });

        setSelectedCameraId(
          stream.getVideoTracks()[0]?.getSettings().deviceId || ""
        );

        setSelectedMicId(
          stream.getAudioTracks()[0]?.getSettings().deviceId || ""
        );

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();

        if (!active) return;

        setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devices.filter((d) => d.kind === "videoinput"));

        const savedSpeaker = localStorage.getItem("speakerDeviceId");
        if (savedSpeaker && devices.some(
          (d) => d.kind === "audiooutput" && d.deviceId === savedSpeaker
        )) {
          setSelectedSpeakerId(savedSpeaker);
        } else {
          setSelectedSpeakerId(
            devices.find((d) => d.kind === "audiooutput")?.deviceId || ""
          );
        }

        setDeviceError("");
      } catch (error) {
        console.error("Device initialization failed:", error);
        setDeviceError(
          "Allow camera and microphone access to select your devices."
        );
      }
    }

    initializeDevices();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    myStream?.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOn;
    });

    myStream?.getAudioTracks().forEach((track) => {
      track.enabled = isMicOn;
    });
  }, [myStream, isCameraOn, isMicOn]);

  useEffect(() => {
    const storedName = localStorage.getItem("username");
    if (storedName) {
      setUsername(storedName);
      setRememberName(true);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !myStream) return;

    video.srcObject = myStream;

    const checkOrientation = () => {
      if (!video.videoWidth || !video.videoHeight) return;

      setOrientation(
        video.videoHeight > video.videoWidth
          ? "vertical"
          : "horizontal"
      );
    };

    video.addEventListener("loadedmetadata", checkOrientation);
    video.addEventListener("resize", checkOrientation);

    video.play().catch((error) => {
      console.error("Video preview playback failed:", error);
    });

    if (video.readyState >= 1) {
      checkOrientation();
    }

    return () => {
      video.removeEventListener("loadedmetadata", checkOrientation);
      video.removeEventListener("resize", checkOrientation);
    };
  }, [myStream, isCameraOn]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        micDropdownRef.current &&
        !micDropdownRef.current.contains(event.target)
      ) {
        setIsMicOptionsOpen(false);
      }

      if (
        camDropdownRef.current &&
        !camDropdownRef.current.contains(event.target)
      ) {
        setIsCamOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const refreshDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();

    setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
    setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
  };

  const handleMicChange = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) throw new Error("Microphone could not be started.");

      newTrack.enabled = isMicOn;

      const oldTrack = myStream?.getAudioTracks()[0];
      if (oldTrack) {
        myStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      myStream?.addTrack(newTrack);
      setMyStream(myStream);
      setSelectedMicId(deviceId);
      setDeviceError("");
      await refreshDevices();
    } catch (error) {
      console.error("Microphone selection failed:", error);
      setDeviceError("Could not switch microphone. Check its permissions.");
    }
  };

  const handleCameraChange = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];

      if (!newTrack) {
        throw new Error("Camera could not be started.");
      }

      newTrack.enabled = isCameraOn;

      const currentStream = myStream;

      if (currentStream) {
        currentStream.getVideoTracks().forEach((track) => {
          currentStream.removeTrack(track);
          track.stop();
        });

        currentStream.addTrack(newTrack);
        setMyStream(currentStream);
      } else {
        setMyStream(newStream);
      }

      setSelectedCameraId(deviceId);
      setDeviceError("");
      await refreshDevices();
    } catch (error) {
      console.error("Camera selection failed:", error);
      setDeviceError(
        `Could not switch camera: ${error.message}`
      );
    }
  };

  const handleSpeakerChange = (deviceId) => {
    setSelectedSpeakerId(deviceId);
    localStorage.setItem("speakerDeviceId", deviceId);
  };

  const handleMicToggle = () => {
    setIsMicOn(!isMicOn);
  }

  const handleCameraToggle = () => {
    setIsCameraOn(!isCameraOn);
  }

  const handleJoin = () => {
    if (rememberName) {
      localStorage.setItem("username", username);
    } else {
      localStorage.removeItem("username");
    }

    navigate('/room');
  };

  const handleJoinAsHost = () => {
    setHostPassword("");
    setHostPasswordError("");
    setIsHostPasswordOpen(true);
  };

  const handleHostPasswordSubmit = async (event) => {
    event.preventDefault();

    const authenticated = await bcrypt.compare(hostPassword, "$2b$10$6uquSZ9NAg5csfnpSqd1helD2E.pOVClDxPws7JBLA47Jcwus033a", );

    if (!authenticated) {
      setHostPasswordError("Incorrect password. Please try again.");
      return;
    }

    setIsHost(true);
    setIsHostPasswordOpen(false);
    setHostPasswordError("");

    handleJoin();
  };

  return (
    <div className='w-dvw h-dvh p-5 flex justify-center items-center flex-col gap-5 bg-radial-[at_50%_75%] from-sky-200 via-blue-400 to-blue-900 to-90%'>
      <h1 className='text-center text-blue-900 text-2xl sm:text-3xl md:text-5xl font-bold text-shadow-lg'>
        Disciples Church <span className='text-black text-shadow-lg'>Meet</span>
      </h1>
      <form
        onSubmit={(event) => { event.preventDefault(); }}
        className='w-full inline-block border border-white p-5 rounded shadow-xl bg-white/10 drop-shadow-2xl backdop-filter sm:w-auto'
      >
        <div className='w-full h-full flex gap-5 items-center flex-col sm:flex-col md:flex-row'>
          <div className='w-full sm:w-auto'>
            <div className="w-full sm:w-160 sm:h-90 h-50 border border-white rounded bg-black overflow-hidden">
              {isCameraOn ? (
                <video
                  ref={videoRef}
                  className={`w-full h-full rounded ${orientation === "vertical" ? "object-contain" : "object-cover"
                    }`}
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="w-full h-full bg-black text-white flex justify-center items-center text-3xl rounded">
                  <BsCameraVideoOffFill />
                </div>
              )}
            </div>
            <br />
            <div className='w-full flex justify-center mb-5'>
              <div ref={micDropdownRef} className='w-1/2 flex justify-center'>
                <button
                  className='text-2xl p-2 bg-blue-900 text-white rounded-l border-r hover:cursor-pointer hover:bg-blue-950'
                  onClick={handleMicToggle}
                >
                  {
                    !isMicOn
                      ?
                      <IoMdMicOff />
                      :
                      <IoMdMic />
                  }
                </button>
                <div className="relative inline-block">
                  {/* Dropdown list */}
                  {isMicOptionsOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-white
  rounded-lg shadow-lg border border-gray-200 z-50 p-3 space-y-3">

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Microphone input
                        </label>

                        <select
                          className="w-full border rounded p-2 text-sm text-gray-800"
                          value={selectedMicId}
                          onChange={(e) => handleMicChange(e.target.value)}
                        >
                          {audioInputs.map((device, index) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Speaker output
                        </label>

                        <select
                          className="w-full border rounded p-2 text-sm text-gray-800"
                          value={selectedSpeakerId}
                          onChange={(e) => handleSpeakerChange(e.target.value)}
                        >
                          {audioOutputs.map((device, index) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Speaker ${index + 1}`}
                            </option>
                          ))}
                        </select>

                        {!audioOutputs.length && (
                          <p className="text-xs text-gray-500 mt-1">
                            No speaker devices found.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Toggle button */}
                  <button
                    onClick={() => setIsMicOptionsOpen(!isMicOptionsOpen)}
                    aria-expanded={isMicOptionsOpen}
                    className="text-2xl p-2 bg-blue-900 text-white rounded-r
                   hover:cursor-pointer hover:bg-blue-950"
                  >
                    <IoIosArrowUp />
                  </button>
                </div>
              </div>
              <div ref={camDropdownRef} className='w-1/2 flex justify-center'>
                <button
                  className='text-2xl p-2 bg-blue-900 text-white rounded-l border-r hover:cursor-pointer hover:bg-blue-950'
                  onClick={handleCameraToggle}
                >{
                    !isCameraOn
                      ?
                      <BsCameraVideoOffFill />
                      :
                      <BsCameraVideoFill />
                  }
                </button>
                <div className="relative inline-block">
                  {/* Dropdown list */}
                  {isCamOptionsOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-64 bg-white
  rounded-lg shadow-lg border border-gray-200 z-50 p-3">

                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Camera input
                      </label>

                      <select
                        className="w-full border rounded p-2 text-sm text-gray-800"
                        value={selectedCameraId}
                        onChange={(e) => handleCameraChange(e.target.value)}
                      >
                        {videoInputs.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))}
                      </select>

                      {!videoInputs.length && (
                        <p className="text-xs text-gray-500 mt-1">
                          No cameras found.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Toggle button */}
                  <button
                    onClick={() => setIsCamOptionsOpen(!isCamOptionsOpen)}
                    aria-expanded={isCamOptionsOpen}
                    className="text-2xl p-2 bg-blue-900 text-white rounded-r
                   hover:cursor-pointer hover:bg-blue-950"
                  >
                    <IoIosArrowUp />
                  </button>
                </div>
              </div>
            </div>
            {deviceError && (
              <p className="text-sm text-red-200 text-center mb-3">
                {deviceError}
              </p>
            )}
          </div>
          <div>
            <label className='text-xl font-bold'>
              Enter Your Username
            </label>
            <br />
            <input
              type="text"
              placeholder='Username'
              className='border mb-5 w-full rounded text-xl px-2'
              value={username}
              onChange={(event) => { setUsername(event.target.value) }}
            />
            <br />
            <div className='md:flex'>
              <input
                type="checkbox"
                name="remember"
                id="remember"
                checked={rememberName}
                onChange={(event) => setRememberName(event.target.checked)}
              />
              <p>Remember my name for future meetings</p>
            </div>
            <br />
            {/* <label className='text-xl font-bold'>Enter Room Number</label><br />
        <input type="text" placeholder='Room ID' className='border mb-5 w-full rounded text-xl px-2' /><br /> */}
            <button
              type='submit'
              className='rounded w-full bg-blue-900 text-white hover:cursor-pointer hover:bg-blue-950 py-1'
              onClick={handleJoin}
            >
              Join
            </button>
            <button
              type='submit'
              className='rounded w-full bg-blue-900 text-white hover:cursor-pointer hover:bg-blue-950 py-1 mt-1'
              onClick={handleJoinAsHost}
            >
              Join as Host
            </button>
          </div>
        </div>
      </form>
      {isHostPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsHostPasswordOpen(false);
              setHostPasswordError("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="host-password-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            {/* Modal Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2
                id="host-password-title"
                className="text-xl font-semibold text-gray-900"
              >
                Host Authentication
              </h2>

              <button
                type="button"
                onClick={() => {
                  setIsHostPasswordOpen(false);
                  setHostPasswordError("");
                }}
                aria-label="Close modal"
                className="rounded px-3 py-1 text-2xl text-gray-600 hover:bg-gray-100"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleHostPasswordSubmit}>
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="host-password"
                    className="mb-2 block font-medium text-gray-800"
                  >
                    Enter Password
                  </label>

                  <input
                    id="host-password"
                    type="password"
                    placeholder="Enter host password"
                    value={hostPassword}
                    onChange={(event) => {
                      setHostPassword(event.target.value);
                      setHostPasswordError("");
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-600"
                    autoFocus
                    required
                  />
                </div>

                {hostPasswordError && (
                  <p role="alert" className="text-sm text-red-600">
                    {hostPasswordError}
                  </p>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-900 px-4 py-3 font-medium text-white hover:bg-blue-950"
                >
                  Join
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsHostPasswordOpen(false);
                    setHostPassword("");
                    setHostPasswordError("");
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Lobby