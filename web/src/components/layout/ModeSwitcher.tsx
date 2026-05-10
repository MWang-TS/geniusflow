import { Tooltip } from 'antd'
import { NodeIndexOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { usePlatformModeStore, PLATFORM_MODES, type PlatformMode } from '@/stores/platform-mode.store'
import { MODE_DEFAULT_ROUTES } from '@/config/defaultRoutes'

const ICONS: Record<PlatformMode, React.ReactNode> = {
  workflow: <NodeIndexOutlined />,
  assistant: <RobotOutlined />,
  'api-platform': <ApiOutlined />,
}

const MODE_COLORS: Record<PlatformMode, string> = {
  workflow: '#1677ff',
  assistant: '#52c41a',
  'api-platform': '#722ed1',
}

export default function ModeSwitcher() {
  const { mode, setMode } = usePlatformModeStore()
  const navigate = useNavigate()

  const handleChange = (next: PlatformMode) => {
    setMode(next)
    navigate(MODE_DEFAULT_ROUTES[next])
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {PLATFORM_MODES.map((m) => {
        const active = mode === m.key
        return (
          <Tooltip key={m.key} title={m.label} placement="bottomRight">
            <div
              onClick={() => handleChange(m.key)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: active ? MODE_COLORS[m.key] : 'transparent',
                color: active ? '#fff' : 'rgba(0,0,0,0.45)',
                fontSize: 16,
                flexShrink: 0,
                transition: 'background-color 0.2s, color 0.2s',
              }}
            >
              {ICONS[m.key]}
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}
