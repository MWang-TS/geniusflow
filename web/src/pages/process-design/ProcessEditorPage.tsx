import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout,
  Input,
  Button,
  Space,
  App,
  Typography,
  Spin,
  Alert,
} from 'antd'
import {
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import ProcessCanvas from '../../components/process/ProcessCanvas'
import NodeLibrary from '../../components/process/NodeLibrary'
import NodePropertyPanel from '../../components/process/NodePropertyPanel'
import { useProcessDesignStore } from '../../stores/process-design.store'
import { processDefinitionApi } from '../../api/process-definition'

const { Header, Content } = Layout
const { Title } = Typography

const ProcessEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const {
    currentProcess,
    isLoading,
    isSaving,
    loadProcess,
    resetProcess,
    saveDraft,
    publish,
    updateName,
  } = useProcessDesignStore()

  const [isNew, setIsNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [panelWidth, setPanelWidth] = useState(280)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX.current - ev.clientX
      const newWidth = Math.max(220, Math.min(600, startWidth.current + delta))
      setPanelWidth(newWidth)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  useEffect(() => {
    if (id && id !== 'new') {
      loadProcess(id).catch(() => {
        message.error('加载流程失败')
        navigate('/processes')
      })
    } else {
      setIsNew(true)
      resetProcess()
    }
    return () => {
      resetProcess()
    }
  }, [id])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      message.warning('请输入流程名称')
      return
    }
    setCreating(true)
    try {
      const res = await processDefinitionApi.create({
        name: newName.trim(),
        graphJson: { nodes: [], edges: [] },
      })
      navigate(`/processes/${res.data.id}/edit`, { replace: true })
      setIsNew(false)
      await loadProcess(res.data.id)
    } catch {
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }, [newName, navigate, loadProcess, message])

  const handleSave = useCallback(async () => {
    try {
      await saveDraft()
      message.success('保存成功')
    } catch (e: unknown) {
      message.error((e as Error)?.message || '保存失败')
    }
  }, [saveDraft, message])

  const handlePublish = useCallback(() => {
    if (!currentProcess) return
    const validation = useProcessDesignStore.getState().validate()
    if (!validation.valid) {
      modal.error({
        title: '无法发布',
        content: (
          <div>
            {validation.errors.map((err, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                {err}
              </div>
            ))}
          </div>
        ),
      })
      return
    }

    modal.confirm({
      title: '确认发布',
      icon: <ExclamationCircleOutlined />,
      content: '发布后流程将变为"已发布"状态，不再允许编辑。确认发布吗？',
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        try {
          await publish()
          message.success('发布成功')
        } catch (e: unknown) {
          message.error((e as Error)?.message || '发布失败')
        }
      },
    })
  }, [currentProcess, publish, message, modal])

  if (isNew) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5' }}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <Title level={4}>创建新流程</Title>
          <Space direction="vertical" size="middle" style={{ marginTop: 16 }}>
            <Input
              placeholder="请输入流程名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={handleCreate}
              style={{ width: 300 }}
              size="large"
            />
            <Button type="primary" size="large" loading={creating} onClick={handleCreate} block>
              开始设计
            </Button>
            <Button onClick={() => navigate('/processes')} block>
              返回列表
            </Button>
          </Space>
        </div>
      </div>
    )
  }

  if (isLoading || !currentProcess) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5' }}>
        <Spin size="large" tip="加载流程..." />
      </div>
    )
  }

  const isPublished = currentProcess.status === 'published'

  return (
    <Layout style={{ height: '100vh', background: '#f5f5f5' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          height: 56,
          lineHeight: '56px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/processes')}
          />
          <Input
            value={currentProcess.name}
            onChange={(e) => !isPublished && updateName(e.target.value)}
            onBlur={() => !isPublished && handleSave()}
            bordered={false}
            disabled={isPublished}
            style={{ fontSize: 16, fontWeight: 600, width: 280 }}
            maxLength={50}
          />
          {currentProcess.status && (
            <span
              style={{
                padding: '2px 12px',
                borderRadius: 4,
                fontSize: 12,
                background: isPublished ? '#f6ffed' : '#fff7e6',
                color: isPublished ? '#52c41a' : '#fa8c16',
                border: `1px solid ${isPublished ? '#b7eb8f' : '#ffd591'}`,
              }}
            >
              {isPublished ? '已发布' : '草稿'}
            </span>
          )}
        </Space>
        <Space>
          {!isPublished && (
            <Button icon={<SaveOutlined />} loading={isSaving} onClick={handleSave}>
              保存草稿
            </Button>
          )}
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={isSaving}
            onClick={handlePublish}
            disabled={isPublished}
          >
            发布
          </Button>
        </Space>
      </Header>
      {isPublished && (
        <Alert
          message="该流程已发布，处于只读状态，无法修改。如需修改请创建新版本。"
          type="warning"
          showIcon
          banner
          style={{ zIndex: 1 }}
        />
      )}
      <Content style={{ height: isPublished ? 'calc(100vh - 56px - 40px)' : 'calc(100vh - 56px)', display: 'flex', overflow: 'hidden' }}>
        {/* Node library - fixed 200px */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            height: '100%',
            padding: 16,
            background: '#fafafa',
            borderRight: '1px solid #f0f0f0',
            overflowY: 'auto',
          }}
        >
          <NodeLibrary readOnly={isPublished} />
        </div>

        {/* Canvas - flex grow */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          <ProcessCanvas key={currentProcess?.id} readOnly={isPublished} />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          style={{
            width: 5,
            flexShrink: 0,
            height: '100%',
            cursor: 'col-resize',
            background: 'transparent',
            borderLeft: '1px solid #f0f0f0',
            position: 'relative',
            zIndex: 10,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e6f4ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="拖动调整宽度"
        />

        {/* Property panel - resizable */}
        <div
          style={{
            width: panelWidth,
            flexShrink: 0,
            height: '100%',
            padding: 16,
            background: '#fafafa',
            overflowY: 'auto',
          }}
        >
          <NodePropertyPanel readOnly={isPublished} />
        </div>
      </Content>
    </Layout>
  )
}

export default ProcessEditorPage
