import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import LoginPage from './pages/login/LoginPage'
import MainLayout from './components/layout/MainLayout'
import RouteGuard from './components/common/RouteGuard'
import ProcessListPage from './pages/process-design/ProcessListPage'
import ProcessEditorPage from './pages/process-design/ProcessEditorPage'
import ProcessInstanceListPage from './pages/process-instance/ProcessInstanceListPage'
import CreateProcessInstancePage from './pages/process-instance/CreateProcessInstancePage'
import InstanceDetailPage from './pages/process-instance/InstanceDetailPage'
import MyTasksPage from './pages/my-tasks/MyTasksPage'
import NodeExecutionPage from './pages/my-tasks/NodeExecutionPage'
import ApprovalListPage from './pages/approval/ApprovalListPage'
import ApprovalDetailPage from './pages/approval/ApprovalDetailPage'
import KnowledgeBaseListPage from './pages/knowledge-base/KnowledgeBaseListPage'
import ProgressListPage from './pages/progress/ProgressListPage'
import ProgressDetailPage from './pages/progress/ProgressDetailPage'
import NotificationListPage from './pages/notifications/NotificationListPage'
import TemplateMarketPage from './pages/template/TemplateMarketPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import RoleManagementPage from './pages/admin/RoleManagementPage'

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
            <Route path="instances" element={<ProcessInstanceListPage />} />
            <Route path="instances/new" element={<CreateProcessInstancePage />} />
            <Route path="instances/:id" element={<InstanceDetailPage />} />
            <Route path="my-tasks" element={<MyTasksPage />} />
            <Route path="my-tasks/:nodeInstanceId/execute" element={<NodeExecutionPage />} />
            <Route path="approvals" element={<ApprovalListPage />} />
            <Route path="approvals/:taskId" element={<ApprovalDetailPage />} />
            <Route path="knowledge-bases" element={<KnowledgeBaseListPage />} />
            <Route path="progress" element={<ProgressListPage />} />
            <Route path="progress/:id" element={<ProgressDetailPage />} />
            <Route path="notifications" element={<NotificationListPage />} />
            <Route path="templates" element={<TemplateMarketPage />} />
            <Route path="admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="admin/roles" element={<RoleManagementPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AntApp>
  )
}

export default App
