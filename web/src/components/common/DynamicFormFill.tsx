import React from 'react'
import { Input, InputNumber, Select, Upload, Form } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { InputField } from '../../types/process'

interface DynamicFormFillProps {
  fields?: InputField[]
  values?: Record<string, unknown>
  onChange?: (values: Record<string, unknown>) => void
  readonly?: boolean
}

const DynamicFormFill: React.FC<DynamicFormFillProps> = ({
  fields = [],
  values = {},
  onChange,
  readonly = false,
}) => {
  const [form] = Form.useForm()

  const handleValuesChange = (_: unknown, allValues: Record<string, unknown>) => {
    onChange?.(allValues)
  }

  const renderField = (field: InputField) => {
    const name = field.name
    switch (field.type) {
      case 'number':
        return (
          <InputNumber
            style={{ width: '100%' }}
            disabled={readonly}
            placeholder={`请输入${name}`}
          />
        )
      case 'select':
        return (
          <Select
            disabled={readonly}
            placeholder={`请选择${name}`}
            options={field.options?.map((o) => ({ label: o, value: o })) || []}
          />
        )
      case 'file':
        return (
          <Upload
            disabled={readonly}
            maxCount={1}
            beforeUpload={() => false}
          >
            <button type="button" style={{ border: 0, background: 'none', cursor: readonly ? 'not-allowed' : 'pointer' }}>
              <UploadOutlined /> 选择文件
            </button>
          </Upload>
        )
      case 'text':
      default:
        return (
          <Input.TextArea
            rows={3}
            disabled={readonly}
            placeholder={`请输入${name}`}
          />
        )
    }
  }

  if (fields.length === 0) {
    return <div style={{ color: '#999', padding: '12px 0' }}>暂未配置输入字段</div>
  }

  return (
    <Form
      form={form}
      layout="vertical"
      size="small"
      initialValues={values}
      onValuesChange={handleValuesChange}
    >
      {fields.map((field) => (
        <Form.Item
          key={field.name}
          label={field.name}
          name={field.name}
          rules={field.required ? [{ required: true, message: `请输入${field.name}` }] : []}
        >
          {renderField(field)}
        </Form.Item>
      ))}
    </Form>
  )
}

export default DynamicFormFill
