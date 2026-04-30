import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import LoginPage from './pages/login/LoginPage'
import MainLayout from './components/layout/MainLayout'
import RouteGuard from './components/common/RouteGuard'
import ProcessListPage from './pages/process-design/ProcessListPage'
import ProcessEditorPage from './pages/process-design/ProcessEditorPage'

function App() {
  return (
    <AntApp>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/processes/:id/edit"
            element={
              <RouteGuard roles={['designer', 'admin']}>
                <ProcessEditorPage />
              </RouteGuard>
            }
          />
          <Route
            path="/"
            element={
              <RouteGuard roles={['designer', 'employee', 'manager', 'admin']}>
                <MainLayout />
              </RouteGuard>
            }
          >
            <Route index element={<Navigate to="/processes" replace />} />
            <Route path="processes" element={<ProcessListPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AntApp>
  )
}

export default App
