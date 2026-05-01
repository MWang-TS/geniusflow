import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Select, DatePicker, Button, App, Descriptions, Tag, List } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { processDefinitionApi } from '../../api/process-definition'
import { processInstanceApi } from '../../api/process-instance'
import { usersApi } from '../../api/users'
import type { ProcessDefinition } from '../../types/process'
import dayjs from 'dayjs'

interface UserOption {
  id: string
  name: string
}

const CreateProcessInstancePage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [definitions, setDefinitions] = useState<Array<{ id: string; name: string }>>([])
  const [selectedDef, setSelectedDef] = useState<ProcessDefinition | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    processDefinitionApi.list({ status: 'published', pageSize: 200 }).then((r) =>
      setDefinitions(r.data.list.map((d) => ({ id: d.id, name: d.name }))))
    usersApi.list().then((r) => {
      if (r.data?.list) setUsers(r.data.list)
      else if (Array.isArray(r.data)) setUsers(r.data)
      else if (Array.isArray(r.data?.data)) setUsers(r.data.data)
    }).catch(() => {})
  }, [])

  const handleDefinitionChange = useCallback(async (defId: string) => {
    if (!defId) { setSelectedDef(null); return }
    try {
      const res = await processDefinitionApi.getById(defId)
      setSelectedDef(res.data)
      const assignees: Record<string, string> = {}
      res.data.nodes.forEach((n) => {
        if (n.nodeType !== 'start' && n.nodeType !== 'end') assignees[n.id] = ''
      })
      form.setFieldsValue({ assignees, plannedStartDate: dayjs() })
    } catch {
      message.error('加载流程定义失败')
    }
  }, [form, message])

  const handleCreate = useCallback(async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return

    if (!selectedDef) return

    const taskNodes = selectedDef.nodes.filter((n) => n.nodeType === 'task')
    const unassigned = taskNodes.filter((n) => !values.assignees?.[n.id])
    if (unassigned.length > 0) {
      message.warning(`还有 ${unassigned.length} 个任务节点未分配执行人`)
      return
    }

    const nodeAssignees: Record<string, { assigneeUserId: string }> = {}
    taskNodes.forEach((n) => {
      if (values.assignees?.[n.id]) {
        nodeAssignees[n.id] = { assigneeUserId: values.assignees[n.id] }
      }
    })

    setCreating(true)
    try {
      const res = await processInstanceApi.create({
        definitionId: selectedDef.id,
        plannedStartDate: values.plannedStartDate?.format('YYYY-MM-DD'),
        nodeAssignees,
      })
      message.success('流程实例创建成功')
      navigate(`/instances/${res.data.id}`)
    } catch {
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }, [form, selectedDef, navigate, message])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/instances')}
        style={{ marginBottom: 16 }}>返回列表</Button>

      <Card title="创建流程实例">
        <Form form={form} layout="vertical">
          <Form.Item label="选择流程定义" name="definitionId" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="选择已发布的流程定义" showSearch allowClear
              filterOption={(input, option) => (option?.label as string || '').includes(input)}
              options={definitions.map((d) => ({ label: d.name, value: d.id }))}
              onChange={handleDefinitionChange} />
          </Form.Item>

          <Form.Item label="计划开始日期" name="plannedStartDate"
            rules={[{ required: true, message: '请选择' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>

        {selectedDef && (
          <>
            <Descriptions title="流程概览" size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="流程名称">{selectedDef.name}</Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedDef.version}</Descriptions.Item>
              <Descriptions.Item label="总节点数">{selectedDef.nodes.length}</Descriptions.Item>
              <Descriptions.Item label="任务节点数">
                {selectedDef.nodes.filter((n) => n.nodeType === 'task').length}
              </Descriptions.Item>
            </Descriptions>

            <Card title="分配执行人" size="small" style={{ marginTop: 16 }}>
              <List
                dataSource={selectedDef.nodes.filter((n) => n.nodeType === 'task')}
                renderItem={(node) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color={node.nodeType === 'start' ? 'blue' : node.nodeType === 'end' ? 'red' : 'default'}>
                          {node.nodeType === 'start' ? '开始' : node.nodeType === 'end' ? '结束' : '任务'}
                        </Tag>
                        <span>{node.nodeName}</span>
                        {node.progressConfig?.plannedDuration && (
                          <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                            工期 {node.progressConfig.plannedDuration} 天
                          </span>
                        )}
                      </div>
                      <Form.Item name={['assignees', node.id]} noStyle>
                        <Select placeholder="选择执行人" showSearch allowClear style={{ width: '100%' }}
                          filterOption={(input, option) => (option?.label as string || '').includes(input)}
                          options={users.map((u) => ({ label: u.name, value: u.id }))} />
                      </Form.Item>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />}
            loading={creating} disabled={!selectedDef}
            onClick={handleCreate}>
            创建实例
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default CreateProcessInstancePage
