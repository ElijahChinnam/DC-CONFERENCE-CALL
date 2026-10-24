import React, { useContext, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserContext from '../contexts/UserContext';
import MicContext from '../contexts/MicContext';
import CameraContext from '../contexts/CameraContext';
import MyStreamContext from '../contexts/MyStreamContext';
import { IoMdMic } from "react-icons/io";
import { IoMdMicOff } from "react-icons/io";
import { BsCameraVideoFill } from "react-icons/bs";
import { BsCameraVideoOffFill } from "react-icons/bs";

function Lobby() {

  const navigate = useNavigate();

  const { username, setUsername } = useContext(UserContext);
  const { isMicOn, setIsMicOn } = useContext(MicContext);
  const { isCameraOn, setIsCameraOn } = useContext(CameraContext);
  const { myStream, setMyStream } = useContext(MyStreamContext);

  const videoRef = useRef(null);

  useEffect(() => {
    let stream;

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

    startCamera();

    // return () => {
    //   stream?.getTracks().forEach((track) => track.stop());
    // };
  }, [isCameraOn]);

  const handleMicToggle = () => {
    setIsMicOn(!isMicOn);
  }

  const handleCameraToggle = () => {
    setIsCameraOn(!isCameraOn);
  }

  return (
    <div className='w-full h-screen flex justify-center items-center flex-col gap-5 bg-radial-[at_50%_75%] from-sky-200 via-blue-400 to-blue-900 to-90%'>
      <h1 className='text-center text-blue-900 text-5xl font-bold text-shadow-lg'>DC <span className='text-black text-shadow-lg'>Conference Call</span></h1>
      <form onSubmit={(event) => { event.preventDefault(); }} className='inline-block border border-white p-5 rounded shadow-xl bg-white/10 drop-shadow-2xl backdop-filter'>
        <div className='w-full h-full flex gap-5 items-center sm:flex-col md:flex-row'>
          <div className=''>
            <div className='w-160 h-90 border border-white rounded'>
              {isCameraOn ? <video className='w-full h-full object-cover rounded' ref={videoRef} autoPlay muted></video> : <div className='w-full h-full bg-black text-white flex justify-center items-center text-3xl rounded'><BsCameraVideoOffFill /></div>}
            </div>
            <br />
            <div className='w-full flex justify-center mb-5'>
              <div className='w-1/2 flex justify-center'>
                <button className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer' onClick={handleMicToggle}>{!isMicOn ? <IoMdMicOff /> : <IoMdMic />}</button>
              </div>
              <div className='w-1/2 flex justify-center'>
                <button className='text-2xl p-2 bg-blue-900 text-white rounded hover:cursor-pointer' onClick={handleCameraToggle}>{!isCameraOn ? <BsCameraVideoOffFill /> : <BsCameraVideoFill />}</button>
              </div>
            </div>
          </div>
          <div>
            <label className='text-xl font-bold'>Enter Your Username</label><br />
            <input type="text" placeholder='Username' className='border mb-5 w-full rounded text-xl px-2' value={username} onChange={(event) => { setUsername(event.target.value) }} /><br />
            {/* <label className='text-xl font-bold'>Enter Room Number</label><br />
        <input type="text" placeholder='Room ID' className='border mb-5 w-full rounded text-xl px-2' /><br /> */}
            <button type='submit' className='rounded w-full bg-blue-900 text-white hover:cursor-pointer hover:bg-blue-950 py-1' onClick={() => navigate('/room')}>Join</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default Lobby