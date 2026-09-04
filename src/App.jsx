import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Perfil from './pages/Perfil'
import Clientes from './pages/Clientes'
import ClienteDetalle from './pages/ClienteDetalle'
import Pipeline from './pages/Pipeline'
import Gestiones from './pages/Gestiones'
import Email from './pages/Email'
import NuevaOT from './pages/NuevaOT'
import Configuracion from './pages/Configuracion'
import Taller from './pages/Taller'
import Vehiculos from './pages/Vehiculos'
import NuevoCliente from './pages/NuevoCliente'
import CierreAsesor from './pages/CierreAsesor'
import Generador from './pages/Generador'
import EncuestaPublica from './pages/EncuestaPublica'
import ControlOT from './pages/ControlOT'
import Agenda from './pages/Agenda'
import Calendario from './pages/Calendario'
import Informes from './pages/Informes'
import Campanas from './pages/Campanas'
import Presupuestos from './pages/Presupuestos'
import Datos from './pages/Datos'
import Usuarios from './pages/Usuarios'
import CapturaError from './components/CapturaError'

const conLayout = (el) => (
  <ProtectedRoute>
    <Layout>
      {/* Si la página lanza un error al renderizar, se muestra el detalle en
          lugar de dejar la pantalla en blanco. El menú sigue funcionando. */}
      <CapturaError>{el}</CapturaError>
    </Layout>
  </ProtectedRoute>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Pública: el cliente la abre desde el correo, sin cuenta */}
      <Route path="/encuesta" element={<EncuestaPublica />} />
      <Route path="/"            element={conLayout(<Dashboard />)} />
      <Route path="/perfil"      element={conLayout(<Perfil />)} />
      <Route path="/clientes"    element={conLayout(<Clientes />)} />
      <Route path="/clientes/:id" element={conLayout(<ClienteDetalle />)} />
      <Route path="/pipeline"    element={conLayout(<Pipeline />)} />
      <Route path="/gestiones"   element={conLayout(<Gestiones />)} />
      <Route path="/agenda"      element={conLayout(<Agenda />)} />
      <Route path="/calendario"  element={conLayout(<Calendario />)} />
      <Route path="/informes"    element={
        <ProtectedRoute soloAdmin><Layout><Informes /></Layout></ProtectedRoute>
      } />
      <Route path="/campanas"    element={conLayout(<Campanas />)} />
      <Route path="/email"       element={
        <ProtectedRoute soloAdmin><Layout><Email /></Layout></ProtectedRoute>
      } />
      <Route path="/presupuestos" element={conLayout(<Presupuestos />)} />
      <Route path="/datos"       element={conLayout(<Datos />)} />
      <Route path="/nueva-ot"    element={conLayout(<NuevaOT />)} />
      <Route path="/taller"      element={conLayout(<Taller />)} />
      <Route path="/nuevo-cliente" element={conLayout(<NuevoCliente />)} />
      <Route path="/cierres"       element={conLayout(<CierreAsesor />)} />
      <Route path="/generador"     element={conLayout(<Generador />)} />
      <Route path="/vehiculos"     element={conLayout(<Vehiculos />)} />
      <Route path="/vehiculos/:id" element={conLayout(<Vehiculos />)} />
      <Route path="/control-ot"  element={conLayout(<ControlOT />)} />
      <Route path="/configuracion" element={
        <ProtectedRoute soloAdmin><Layout><Configuracion /></Layout></ProtectedRoute>
      } />
      <Route path="/usuarios"    element={
        <ProtectedRoute soloAdmin><Layout><Usuarios /></Layout></ProtectedRoute>
      } />
    </Routes>
  )
}
