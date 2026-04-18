import React, { useEffect } from 'react'
import Imgpage1 from './Imgpage1'
import Popularp from './Popularp'
import Latest from './Latest'
import Newgame from './Newgame'

export default function Home() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="mainbox">
      <Imgpage1 />
      <Popularp />
      <Latest />
      <Newgame />
    </div>
  )
}
