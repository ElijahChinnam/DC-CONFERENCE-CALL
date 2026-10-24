import React, { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import UserContext from './contexts/UserContext';
import MicContext from './contexts/MicContext';
import CameraContext from './contexts/CameraContext';
import MyStreamContext from './contexts/MyStreamContext';
import SocketContext from './contexts/SocketContext';
import { io } from "socket.io-client";

function App() {

  const [username, setUsername] = useState('ELIJAH');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [myStream, setMyStream] = useState(null);

  // const socket = useMemo(() => io("ws://localhost:3000"), []);
  const socket = 10;
  // const socket = io(
  //   import.meta.env.VITE_SIGNALING_SERVER_URL,
  //   {
  //     autoConnect: false,
  //     transports: ["websocket"],
  //   }
  // );

  return (
    <SocketContext.Provider value={socket}>
      <MyStreamContext.Provider value={{ myStream, setMyStream }}>
        <UserContext.Provider value={{ username, setUsername }}>
          <MicContext.Provider value={{ isMicOn, setIsMicOn }}>
            <CameraContext.Provider value={{ isCameraOn, setIsCameraOn }}>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/lobby" element={<Lobby />} />
                  <Route path="/room" element={<Room />} />
                </Routes>
              </BrowserRouter>
            </CameraContext.Provider>
          </MicContext.Provider>
        </UserContext.Provider >
      </MyStreamContext.Provider>
    </SocketContext.Provider>
  )
}

export default App