import React from 'react'
import { useNavigate } from 'react-router-dom';

function Home() {

  const navigate = useNavigate();

  return (
    <div>
      <div className='w-full h-dvh flex justify-center items-center flex-col bg-radial-[at_50%_75%] from-sky-200 via-blue-400 to-blue-900 to-90%"'>
        <h1 className='text-center text-blue-900 text-5xl md:text-7xl font-bold text-shadow-md'>DC <span className='font-normal text-black'>Conference Call</span></h1>
        <div className='rounded text-center shadow-lg px-5 m-5 bg-white/10 backdrop-filter backdrop-blur-lg'>
          <h1 className='text-2xl font-bold my-5'>Meeting Details</h1>
          <h1 className='text-xl mb-1'>DC Midweek Fellowship: Every Thursday at 07:00 PM IST</h1>
          <h1 className='text-xl mb-5'>DC Men's Fellowship: Every Saturday at 09:00 PM IST</h1>
        </div>
        <button className='rounded bg-blue-900 text-white text-2xl px-3 py-2 hover:cursor-pointer hover:bg-blue-950' onClick={() => navigate('/lobby')}>Join The Meeting</button>
      </div>
    </div>
  )
}

export default Home