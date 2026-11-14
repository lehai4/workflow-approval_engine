import { fwHttp } from '@/api/fwHttp'
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useMemo, useState } from 'react'

const { Title, Text } = Typography

const DEFAULT_FILTERS = {
  type: '',
  proposalName: '',
  createdFrom: '',
  createdTo: '',
  includeHidden: true,
}

const formatDateTime24h = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

const ConfigCommons = () => {
  const { modal } = App.useApp()
  const [messageApi, contextHolder] = message.useMessage()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [types, setTypes] = useState([])
  const [items, setItems] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  useEffect(() => {
    loadTypes()
    loadList()
  }, [])

  const selectedCount = selectedIds.length

  const typeOptions = useMemo(() => {
    const labelCountMap = new Map()

    for (const item of types) {
      const baseLabel = item?.label || item?.name || 'Không có tên'
      labelCountMap.set(baseLabel, (labelCountMap.get(baseLabel) || 0) + 1)
    }

    return types.map((item) => {
      const value = item?.value || item?.code || item?.id
      const baseLabel = item?.label || item?.name || 'Không có tên'
      const duplicateCount = labelCountMap.get(baseLabel) || 0
      const technicalCode = (item?.name || '').trim()
      const shortUid = String(value || '').slice(0, 8)

      let suffix = ''
      if (duplicateCount > 1) {
        if (technicalCode) {
          suffix = ` - ${technicalCode}`
        } else if (shortUid) {
          suffix = ` - ${shortUid}`
        }
      }

      return {
        value,
        label: `${baseLabel}${suffix}`,
        searchText: `${baseLabel} ${technicalCode} ${value || ''}`.toLowerCase(),
        meta: {
          baseLabel,
          technicalCode,
          uid: value,
          duplicateCount,
        },
      }
    })
  }, [types])

  const selectedTypeOption = useMemo(
    () => typeOptions.find((option) => option.value === filters.type),
    [filters.type, typeOptions]
  )

  const loadTypes = async () => {
    try {
      const response = await fwHttp.getAdminProposalVisibilityTypes()
      setTypes(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch (err) {
      console.error('loadTypes error', err)
      setError(err.message || 'Không thể tải loại đề nghị')
    }
  }

  const loadList = async (customFilters = filters) => {
    try {
      setLoading(true)
      setError('')

      const response = await fwHttp.getAdminProposalVisibilityList(customFilters)
      const nextItems = Array.isArray(response?.data?.data) ? response.data.data : []

      setItems(nextItems)
      setSelectedIds([])
    } catch (err) {
      console.error('loadList error', err)
      setError(err.message || 'Không thể tải danh sách đề nghị')
    } finally {
      setLoading(false)
    }
  }

  const onChangeFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const onSearch = () => {
    loadList(filters)
  }

  const onReset = () => {
    setFilters(DEFAULT_FILTERS)
    loadList(DEFAULT_FILTERS)
  }

  const updateVisibility = async (ids, hiddenByAdmin) => {
    const response = await fwHttp.updateAdminProposalVisibility({
      ids,
      hiddenByAdmin,
    })

    return response?.data
  }

  const hideSelected = () => {
    if (selectedIds.length === 0) {
      messageApi.warning('Vui lòng chọn ít nhất một đề nghị.')
      return
    }

    modal.confirm({
      title: 'Xác nhận ẩn đề nghị',
      content: `Ẩn tạm ${selectedIds.length} đề nghị? Sau khi ẩn, chỉ admin mới thấy.`,
      okText: 'Ẩn tạm',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setSubmitting(true)
          await updateVisibility(selectedIds, true)
          messageApi.success('Ẩn đề nghị thành công.')
          loadList()
        } catch (err) {
          console.error('hideSelected error', err)
          messageApi.error(err.message || 'Có lỗi xảy ra')
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const unhideOne = (id) => {
    modal.confirm({
      title: 'Xác nhận bỏ ẩn',
      content: 'Bỏ ẩn đề nghị này?',
      okText: 'Bỏ ẩn',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await updateVisibility([id], false)
          messageApi.success('Bỏ ẩn đề nghị thành công.')
          loadList()
        } catch (err) {
          console.error('unhideOne error', err)
          messageApi.error(err.message || 'Có lỗi xảy ra')
        }
      },
    })
  }

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (keys) => setSelectedIds(keys),
  }

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (value) => value || '-',
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (value) => value || '-',
    },
    {
      title: 'Loại đề nghị',
      key: 'typeName',
      width: 200,
      responsive: ['md'],
      render: (_, record) => record.typeName || record.type || '-',
    },
    {
      title: 'Người tạo',
      key: 'createdByName',
      width: 180,
      responsive: ['md'],
      render: (_, record) => record.createdByName || record.createdBy || '-',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value) => formatDateTime24h(value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'hiddenByAdmin',
      key: 'hiddenByAdmin',
      width: 140,
      align: 'center',
      render: (hidden) => (
        <Tag color={hidden ? 'error' : 'success'}>
          {hidden ? 'Đã ẩn' : 'Đang hiển thị'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) =>
        record.hiddenByAdmin ? (
          <Button size="small" icon={<EyeOutlined />} onClick={() => unhideOne(record.id)}>
            Bỏ ẩn
          </Button>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ]

  return (
    <div className="tw-p-4 md:tw-p-6 tw-min-h-screen">
      {contextHolder}

      <Card className="tw-mb-4 tw-shadow-sm tw-rounded-xl">
        <div className="tw-flex tw-flex-col lg:tw-flex-row tw-items-start lg:tw-items-center tw-justify-between tw-gap-4 tw-mb-4">
          <div>
            <Title level={3} className="!tw-mb-1">
              Cấu hình ẩn đề nghị
            </Title>
            <Text className="tw-text-gray-500">
              Admin chọn đề nghị theo loại và thời gian tạo để tạm ẩn khỏi toàn bộ người liên quan.
            </Text>
          </div>
          <Alert
            type="warning"
            showIcon
            message="Chỉ admin mới còn nhìn thấy các đề nghị đã ẩn."
            className="tw-rounded-lg"
          />
        </div>

        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Loại đề nghị" className="tw-mb-1">
                <Select
                  value={filters.type || undefined}
                  onChange={(value) => onChangeFilter('type', value || '')}
                  placeholder="Tất cả"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) => {
                    const searchText = option?.searchText || option?.label || ''
                    return searchText.includes((input || '').toLowerCase())
                  }}
                  popupMatchSelectWidth={false}
                  className="tw-w-full"
                  options={typeOptions}
                />
              </Form.Item>
              {selectedTypeOption?.meta?.duplicateCount > 1 ? (
                <Text type="warning" className="tw-text-xs tw-block tw-mt-[-4px] tw-mb-2">
                  Loại này trùng tên. Mã phân biệt:{' '}
                  {selectedTypeOption.meta.technicalCode || selectedTypeOption.meta.uid}
                </Text>
              ) : null}
            </Col>

            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Tên đề nghị" className="tw-mb-1">
                <Input
                  value={filters.proposalName}
                  onChange={(e) => onChangeFilter('proposalName', e.target.value)}
                  placeholder="Nhập tên đề nghị"
                  allowClear
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Từ ngày giờ tạo" className="tw-mb-1">
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="DD/MM/YYYY HH:mm"
                  value={filters.createdFrom ? dayjs(filters.createdFrom) : null}
                  onChange={(value) =>
                    onChangeFilter('createdFrom', value ? value.format('YYYY-MM-DDTHH:mm') : '')
                  }
                  allowClear
                  className="tw-w-full"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Đến ngày giờ tạo" className="tw-mb-1">
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="DD/MM/YYYY HH:mm"
                  value={filters.createdTo ? dayjs(filters.createdTo) : null}
                  onChange={(value) =>
                    onChangeFilter('createdTo', value ? value.format('YYYY-MM-DDTHH:mm') : '')
                  }
                  allowClear
                  className="tw-w-full"
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-pt-3 tw-mt-1 tw-border-t tw-border-slate-100">
            <Checkbox
              checked={filters.includeHidden}
              onChange={(e) => onChangeFilter('includeHidden', e.target.checked)}
            >
              Hiển thị cả đề nghị đã ẩn
            </Checkbox>

            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>
                Đặt lại
              </Button>
              <Button type="primary" icon={<SearchOutlined />} onClick={onSearch} loading={loading}>
                Tìm kiếm
              </Button>
              <Button
                danger
                type="primary"
                icon={<EyeInvisibleOutlined />}
                onClick={hideSelected}
                disabled={selectedCount === 0}
                loading={submitting}
              >
                Ẩn tạm ({selectedCount})
              </Button>
            </Space>
          </div>
        </Form>
      </Card>

      {error ? (
        <Alert type="error" showIcon message={error} className="tw-mb-4 tw-rounded-lg" />
      ) : null}

      <Card className="tw-shadow-sm tw-rounded-xl">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
          <Text className="tw-text-sm">
            Danh sách đề nghị: <b>{items.length}</b>
          </Text>
          <Text className="tw-text-sm tw-text-gray-500">
            Đã chọn: <b>{selectedCount}</b>
          </Text>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          rowSelection={rowSelection}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đề nghị`,
          }}
          locale={{ emptyText: 'Không có dữ liệu' }}
        />
      </Card>
    </div>
  )
}

export default ConfigCommons
