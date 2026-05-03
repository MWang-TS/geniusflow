import React, { useState, useEffect, useCallback } from 'react'
import { Drawer, Checkbox, Button, App, Divider, Space, Spin, Tag } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { rolesApi } from '../../api/roles'
import { ALL_ROUTES } from '../../config/routeConfig'

interface RoleRoutesDrawerProps {
  roleId: string
  roleName: string
  open: boolean
  onClose: () => void
}

// 按 group 分组
const groupedRoutes = ALL_ROUTES.reduce<Record<string, typeof ALL_ROUTES>>((acc, r) => {
  const g = r.group || '其他'
  if (!acc[g]) acc[g] = []
  acc[g].push(r)
  return acc
}, {})

const RoleRoutesDrawer: React.FC<RoleRoutesDrawerProps> = ({ roleId, roleName, open, onClose }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkedRoutes, setCheckedRoutes] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await rolesApi.getRoutePermissions(roleId)
      const data = (res as any)?.data ?? res
      setCheckedRoutes(Array.isArray(data.routePermissions) ? data.routePermissions : [])
    } catch {
      message.error('加载路由权限失败')
    } finally {
      setLoading(false)
    }
  }, [roleId, message])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await rolesApi.updateRoutePermissions(roleId, checkedRoutes)
      message.success('路由权限已保存')
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectAll = () => setCheckedRoutes(ALL_ROUTES.map((r) => r.path))
  const handleClearAll = () => setCheckedRoutes([])

  const toggleRoute = (path: string, checked: boolean) => {
    setCheckedRoutes((prev) =>
      checked ? [...prev, path] : prev.filter((r) => r !== path),
    )
  }

  const toggleGroup = (group: string, checked: boolean) => {
    const paths = (groupedRoutes[group] || []).map((r) => r.path)
    setCheckedRoutes((prev) => {
      const rest = prev.filter((r) => !paths.includes(r))
      return checked ? [...rest, ...paths] : rest
    })
  }

  return (
    <Drawer
      title={
        <span>
          路由权限配置 &nbsp;
          <Tag color="blue">{roleName}</Tag>
        </span>
      }
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Space>
          <Button size="small" onClick={handleSelectAll}>全选</Button>
          <Button size="small" onClick={handleClearAll}>清空</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        Object.entries(groupedRoutes).map(([group, routes]) => {
          const groupPaths = routes.map((r) => r.path)
          const checkedCount = groupPaths.filter((p) => checkedRoutes.includes(p)).length
          const groupChecked = checkedCount === groupPaths.length
          const groupIndeterminate = checkedCount > 0 && checkedCount < groupPaths.length

          return (
            <div key={group} style={{ marginBottom: 16 }}>
              <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0' }}>
                <Checkbox
                  checked={groupChecked}
                  indeterminate={groupIndeterminate}
                  onChange={(e) => toggleGroup(group, e.target.checked)}
                  style={{ fontWeight: 600 }}
                >
                  {group}
                </Checkbox>
              </Divider>
              <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {routes.map((r) => (
                  <Checkbox
                    key={r.path}
                    checked={checkedRoutes.includes(r.path)}
                    onChange={(e) => toggleRoute(r.path, e.target.checked)}
                  >
                    {r.label}
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{r.path}</span>
                  </Checkbox>
                ))}
              </div>
            </div>
          )
        })
      )}
    </Drawer>
  )
}

export default RoleRoutesDrawer
