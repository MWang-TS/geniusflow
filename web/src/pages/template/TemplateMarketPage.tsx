import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Tag, Space, App, Input, Row, Col, Pagination, Spin, Empty, Typography, Select } from 'antd'
import { CopyOutlined, ReloadOutlined, ApartmentOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { templateApi, type TemplateItem } from '../../api/template'

const { Paragraph, Text } = Typography

const FUNCTION_OPTIONS = [
  '全部', '市场', '投标', '销售', '研发', '项目管理', '生产运营',
  '仓储、物流、采购', '人事', '行政', '法务', '财务',
  '质量', '客户关爱', 'EHS', '其它',
]

const TemplateMarketPage: React.FC = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [data, setData] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0 })
  const [cloning, setCloning] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (page = 1, pageSize = 12, kw = keyword, cat = category) => {
    setLoading(true)
    try {
      const res = await templateApi.list({ page, pageSize, keyword: kw || undefined, category: cat || undefined })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, category, message])

  useEffect(() => { fetchData(1, 12, keyword, category) }, [])

  const handleSearch = (value: string) => {
    setKeyword(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchData(1, pagination.pageSize, value, category)
    }, 350)
  }

  const handleCategoryChange = (value: string | undefined) => {
    const cat = value === '全部' ? undefined : value
    setCategory(cat)
    fetchData(1, pagination.pageSize, keyword, cat)
  }

  const handleClone = async (id: string) => {
    setCloning(id)
    try {
      const res = await templateApi.clone(id)
      const clonedId = res.data?.id
      message.success('复制成功，即将打开编辑器…')
      if (clonedId) {
        setTimeout(() => navigate(`/processes/${clonedId}/edit`), 800)
      }
    } catch {
      message.error('复制失败')
    } finally {
      setCloning(null)
    }
  }

  return (
    <Card title="模板市场" extra={
      <Space>
        <Select
          placeholder="按职能线筛选"
          style={{ width: 160 }}
          allowClear
          value={category}
          onChange={handleCategoryChange}
          options={FUNCTION_OPTIONS.map(o => ({ label: o, value: o }))}
        />
        <Input.Search
          placeholder="搜索模板名称或描述"
          style={{ width: 220 }}
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={(v) => fetchData(1, pagination.pageSize, v, category)}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize, keyword, category)} />
      </Space>
    }>
      <Spin spinning={loading}>
        {data.length === 0 && !loading ? (
          <Empty description="暂无模板" style={{ padding: '60px 0' }} />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {data.map(item => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        icon={<CopyOutlined />}
                        loading={cloning === item.id}
                        onClick={() => handleClone(item.id)}
                      >
                        复制到我的流程
                      </Button>
                    ]}
                  >
                    <div style={{ flex: 1 }}>
                      <Space style={{ marginBottom: 8 }} wrap>
                        <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
                        {item.isPreset && <Tag color="blue">官方</Tag>}
                        {item.category && <Tag color="default">{item.category}</Tag>}
                      </Space>
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 3 }}
                        style={{ marginBottom: 12, fontSize: 13 }}
                      >
                        {item.description || '暂无描述'}
                      </Paragraph>
                    </div>
                    <Space style={{ fontSize: 12, color: '#999' }}>
                      <ApartmentOutlined />
                      <span>{item.nodeCount ?? 0} 个节点</span>
                      <ClockCircleOutlined style={{ marginLeft: 8 }} />
                      <span>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Pagination
                current={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                showSizeChanger
                pageSizeOptions={[12, 24, 48]}
                showTotal={(t) => `共 ${t} 条`}
                onChange={(p, ps) => fetchData(p, ps, keyword)}
              />
            </div>
          </>
        )}
      </Spin>
    </Card>
  )
}

export default TemplateMarketPage
