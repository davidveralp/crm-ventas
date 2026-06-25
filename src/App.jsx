import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import ClienteDetalle from './pages/ClienteDetalle'
import Pipeline from './pages/Pipeline'
import Agenda from './pages/Agenda'
import Campanas from './pages/Campanas'
import Presupuestos from './pages/Presupuestos'
import Datos from './pages/Datos'
import Usuarios from './pages/Usuarios'

const conLayout = (el) => (
  <ProtectedRoute><Layout>{el}</Layout></ProtectedRoute>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"            element={conLayout(<Dashboard />)} />
      <Route path="/clientes"    element={conLayout(<Clientes />)} />
      <Route path="/clientes/:id" element={conLayout(<ClienteDetalle />)} />
      <Route path="/pipeline"    element={conLayout(<Pipeline />)} />
      <Route path="/agenda"      element={conLayout(<Agenda />)} />
      <Route path="/campanas"    element={conLayout(<Campanas />)} />
      <Route path="/presupuestos" element={conLayout(<Presupuestos />)} />
      <Route path="/datos"       element={conLayout(<Datos />)} />
      <Route path="/usuarios"    element={
        <ProtectedRoute soloAdmin><Layout><Usuarios /></Layout></ProtectedRoute>
      } />
    </Routes>
  )
}
