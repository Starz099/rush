import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Workspace from './pages/Workspace'

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace/:projectId" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default Router
