import { Segmented } from 'antd'
import { NodeIndexOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { usePlatformModeStore, PLATFORM_MODES, type PlatformMode } from '@/stores/platform-mode.store'

const ICONS: Record<PlatformMode, React.ReactNode> = {
  workflow: <NodeIndexOutlined />,
  assistant: <RobotOutlined />,
  'api-platform': <ApiOutlined />,
}

const MODE_DEFAULT_ROUTES: Record<PlatformMode, string> = {
  workflow: '/processes',
  assistant: '/skill-assistant',
  'api-platform': '/api-platform',
}

interface ModeSwitcherProps {
  collapsed?: boolean
}

export default function ModeSwitcher({ collapsed }: ModeSwitcherProps) {
  const { mode, setMode } = usePlatformModeStore()
  const navigate = useNavigate()

  const handleChange = (value: string) => {
    const next = value as PlatformMode
    setMode(next)
    navigate(MODE_DEFAULT_ROUTES[next])
  }

  if (collapsed) {
    return null
  }

  return (
    <Segmented
      value={mode}
      onChange={handleChange}
      options={PLATFORM_MODES.map((m) => ({
        value: m.key,
        label: m.shortLabel,
        icon: ICONS[m.key],
      }))}
      style={{ width: '100%' }}
      size="small"
    />
  )
}
