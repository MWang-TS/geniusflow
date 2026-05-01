import React from 'react'
import { Modal, Tag, List, Typography, Progress } from 'antd'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'

const { Text, Title } = Typography

export interface AiInspectionResult {
  nodeInstanceId: string
  status: string
  passed: boolean
  score?: number
  issues?: Array<{
    type: 'error' | 'warning'
    field: string
    message: string
    suggestion?: string
  }>
  summary?: string
  isFallback?: boolean
  message: string
}

interface AiInspectionOverlayProps {
  visible: boolean
  result: AiInspectionResult | null
  onClose: () => void
  onRetry: () => void
}

const AiInspectionOverlay: React.FC<AiInspectionOverlayProps> = ({
  visible,
  result,
  onClose,
  onRetry,
}) => {
  if (!result) {
    return (
      <Modal
        open={visible}
        closable={false}
        footer={null}
        centered
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <LoadingOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <div style={{ marginTop: 16 }}>
            <Title level={5}>AI 督导正在进行中...</Title>
            <Progress percent={99} status="active" showInfo={false} />
            <Text type="secondary">请稍候，AI 正在检查您的提交内容</Text>
          </div>
        </div>
      </Modal>
    )
  }

  const isFallback = result.isFallback

  return (
    <Modal
      open={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {result.passed || isFallback ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
          )}
          <span>{isFallback ? 'AI 督导降级' : result.passed ? 'AI 督导通过' : 'AI 督导未通过'}</span>
        </div>
      }
      onCancel={onClose}
      footer={null}
      centered
      width={560}
    >
      {isFallback && (
        <div style={{
          background: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
        }}>
          <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
          AI 校验服务超时，已自动降级为人工审批，请耐心等待审批结果。
        </div>
      )}

      {result.score !== undefined && result.score > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text>质量评分</Text>
          <Progress
            percent={result.score}
            status={result.passed ? 'success' : 'exception'}
            format={(p) => `${p}分`}
          />
        </div>
      )}

      {result.issues && result.issues.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>检查问题</Text>
          <List
            size="small"
            dataSource={result.issues}
            renderItem={(issue) => (
              <List.Item>
                <div>
                  <Tag color={issue.type === 'error' ? 'red' : 'orange'}>
                    {issue.type === 'error' ? '错误' : '提醒'}
                  </Tag>
                  <Text strong>{issue.field}</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text>{issue.message}</Text>
                  </div>
                  {issue.suggestion && (
                    <div style={{ marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        建议: {issue.suggestion}
                      </Text>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      {result.summary && (
        <div style={{
          background: '#f5f5f5',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
        }}>
          <Text type="secondary">总结：{result.summary}</Text>
        </div>
      )}

      <div style={{ textAlign: 'right' }}>
        {result.passed ? (
          <div>
            <Text type="success">节点已进入审批环节，请耐心等待审批结果。</Text>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid #d9d9d9',
                background: '#fff',
                padding: '4px 15px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
            <button
              type="button"
              onClick={onRetry}
              style={{
                border: 'none',
                background: '#1677ff',
                color: '#fff',
                padding: '4px 15px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              返回修改
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default AiInspectionOverlay
