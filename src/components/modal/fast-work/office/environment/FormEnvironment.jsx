import { fwHttp } from "@/api/fwHttp";
import {
  SingleDatePicker,
  SingleDateTimePicker,
} from "@/components/common/DatePickerComponents";
import { createTreeData } from "@/helpers";
import { CloseOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import {
  Avatar,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Switch,
  TreeSelect,
} from "antd";
import { TreeNode } from "antd/es/tree-select";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const FormEnvironment = ({
  state,
  width,
  style,
  title = null,
  ma_nv,
  onFinish,
  optionsApproval,
  openEnvironment,
  formEnvironment,
  setOpenEnvironment,
  handleSendEnvironment,
  handleChangeResourceEnvironment,
  handleCloseModalEnvironment,
  handleChangeGroupResource,
  maxAnySelection,
}) => {
  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component
  const [availableData, setAvailableData] = useState([]);
  const [optionsEnvironment, setOptionEnvironment] = useState([]);

  const handleSwitchAutoFillData = async (data) => {
    const date = new Date(data).toLocaleDateString();
    const { uid_group_resource, uid_resource_environment, isCheck } =
      formEnvironment.getFieldsValue();

    if (isCheck && date) {
      const searchQuery = {
        uid_group_resource,
        uid_resource_environment,
        date,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );
      try {
        const res =
          await fwHttp.getInfoAvailableResourceEnvironment(queryParams);
        const { result } = res.data;
        if (result.length === 0) {
          toast.info("Không có tài nguyên nào đang trống trong ngày này!");
          return;
        }
        const names = state.resourceEnvironments
          .filter((item) => Object.keys(result || []).includes(item.uid))
          .map((item) => ({
            ...item,
            gaps: result[item.uid],
          }));
        setAvailableData(names || []);
      } catch (err) {
        toast.error(err.message || "Có lỗi xảy ra!");
      }
    }
  };

  // function formatDateTime(dateString) {
  //   const d = new Date(dateString.replace(" ", "T"));
  //   const day = d.getDate().toString().padStart(2, "0");
  //   const month = (d.getMonth() + 1).toString().padStart(2, "0");
  //   const year = d.getFullYear();
  //   const hours = d.getHours().toString().padStart(2, "0");
  //   const minutes = d.getMinutes().toString().padStart(2, "0");

  //   return `${hours}:${minutes}`;
  // }

  function formatDateTime(dateString) {
    if (!dateString) return "";
    // Accepts formats like 'YYYY-M-D HH:mm:ss' or 'YYYY-MM-DD HH:mm:ss'
    const parts = String(dateString).trim().split(" ");
    const timePart = parts[1] || "";
    const timeSegments = timePart.split(":");
    const hours = (timeSegments[0] || "0").toString().padStart(2, "0");
    const minutes = (timeSegments[1] || "0").toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  useEffect(() => {
    const environmentData = state.resourceEnvironments || [];
    const decentralizationData = state.applicableDecentralization || [];
    const allDepartmentGroupData = state.department || [];
    if (
      environmentData.length &&
      decentralizationData.length &&
      state.syncNV &&
      ma_nv &&
      allDepartmentGroupData.length
    ) {
      const user = state.syncNV.find((nv) => nv.ma_nv === ma_nv);
      if (!user) return;

      const id_pb = user.id_pb;
      const pbInfo = allDepartmentGroupData.find((pb) => pb.id === id_pb);
      if (!pbInfo) return;

      const companyName = pbInfo.ten_cong_ty
        ?.toLowerCase()
        .replace(/\s+/g, "_"); // normalize
      const companyId = pbInfo.id_company;

      const companyDeptKey = `${companyId}-${id_pb}`;
      const companyKey = `${companyName}-${companyId}`;
      // console.log("environmentData", environmentData);
      const filteredEnvironments = environmentData.filter((environment) => {
        const decentralization = decentralizationData.find(
          (a) => a.uid === environment.uid_applicable_decentralization,
        );
        if (!decentralization) return false;

        const groupIds = Array.isArray(
          decentralization.id_group_department_used,
        )
          ? decentralization.id_group_department_used.map((id) =>
              id.toLowerCase(),
            )
          : [];

        const peopleIds = Array.isArray(decentralization.id_group_people_used)
          ? decentralization.id_group_people_used
          : [];

        // ✅ Logic lọc theo group_department
        const canViewByDepartment =
          groupIds.includes("all") ||
          groupIds.includes(companyDeptKey) ||
          groupIds.includes(companyKey);

        if (!canViewByDepartment) return false;

        // ✅ Logic lọc theo group_people
        const canViewByPeople =
          peopleIds.includes("all") || peopleIds.includes(user.ma_nv);

        return canViewByPeople;
      });
      // console.log(filteredEnvironments);
      setOptionEnvironment(filteredEnvironments);
      // return filteredEnvironments;
    }
  }, [
    state.syncNV,
    state.resourceEnvironments,
    state.department,
    state.applicableDecentralization,
    ma_nv,
  ]);
  return (
    <>
      {contextHolder}
      <Modal
        open={openEnvironment}
        onCancel={() => {
          setOpenEnvironment(false);
          formEnvironment.resetFields();
        }}
        placement="top"
        title={title}
        width={width}
        style={style}
        footer={
          <div className="tw-flex tw-flex-row tw-items-center tw-justify-end tw-gap-x-2">
            <Button
              icon={<SendOutlined />}
              type="primary"
              htmlType="submit"
              onClick={handleSendEnvironment}
            >
              Gửi đăng ký
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCloseModalEnvironment}
            >
              Đóng
            </Button>
          </div>
        }
      >
        <div className="tw-grid tw-grid-cols-12 tw-gap-4">
          <div className="tw-col-span-12">
            <Form layout="vertical" form={formEnvironment} onFinish={onFinish}>
              <Row gutter={16}>
                <Col xs={24} sm={24} md={24}>
                  <div>
                    {/* Switch hiển thị khi loại tài nguyên là PH */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.uid_group_resource !== curr.uid_group_resource
                      }
                    >
                      {({ getFieldValue, setFieldsValue }) => {
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid,
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop) return null;

                        return (
                          <Form.Item
                            name="isCheck"
                            valuePropName="checked"
                            noStyle
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                margin: "5px 0",
                              }}
                            >
                              <Switch
                                onChange={(checked) => {
                                  setFieldsValue({ isCheck: checked });
                                  if (!checked) setAvailableData([]); // clear table
                                }}
                              />
                              <span>Xem thời gian trống</span>
                            </div>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>

                    {/* Date Picker hiển thị khi Switch được bật */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.isCheck !== curr.isCheck
                      }
                    >
                      {({ getFieldValue }) => {
                        const isChecked = getFieldValue("isCheck");
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid,
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop || !isChecked) return null;

                        return (
                          <Form.Item name="autoFillInput" noStyle>
                            <div className="tw-my-4">
                              <SingleDatePicker
                                onChange={(date) =>
                                  handleSwitchAutoFillData(date)
                                }
                                name="date"
                                placeholderText="Nhập ngày"
                                required
                              />
                            </div>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>

                    <Divider className="tw-my-2" />

                    {/* Bảng thông tin tài nguyên */}
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid,
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop || availableData.length === 0)
                          return null;

                        return (
                          <>
                            <p className="tw-italic tw-font-bold tw-text-center">
                              Thông tin tài nguyên - giờ trống
                            </p>
                            <div
                              style={{
                                maxHeight: "300px",
                                overflowY: "auto",
                                overflowX: "auto",
                              }}
                            >
                              <table className="table table-bordered responsiveTables tw-w-full">
                                <thead>
                                  <tr>
                                    <th>Tên tài nguyên</th>
                                    <th>Thời gian bắt đầu/kết thúc</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {availableData.map((item) =>
                                    item.gaps.map((child, index) => (
                                      <tr key={`${item.uid}-${index}`}>
                                        {index === 0 && (
                                          <td rowSpan={item.gaps.length}>
                                            {item.name_resource_environment}
                                          </td>
                                        )}
                                        <td>
                                          {formatDateTime(child.gap_start)} -{" "}
                                          {formatDateTime(child.gap_end)}
                                        </td>
                                      </tr>
                                    )),
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <Divider className="tw-my-2" />
                          </>
                        );
                      }}
                    </Form.Item>
                  </div>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="uid_group_resource"
                    label="Loại tài nguyên"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn nhóm tài nguyên",
                      },
                    ]}
                  >
                    <Select
                      placeholder="Chọn nhóm tài nguyên"
                      allowClear
                      showSearch
                      onChange={handleChangeGroupResource}
                      optionFilterProp="children"
                    >
                      {state.groupResources.map((item, i) => (
                        <Select.Option key={i} value={item.uid}>
                          {item.name_group_resource}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item shouldUpdate>
                    {({ getFieldValue }) =>
                      getFieldValue("uid_group_resource") ? (
                        <Form.Item
                          name="uid_resource_environment"
                          label="Tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tài nguyên",
                            },
                          ]}
                        >
                          <Select
                            placeholder="Chọn tài nguyên"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={handleChangeResourceEnvironment}
                          >
                            {optionsEnvironment
                              .filter(
                                (re) =>
                                  re.uid_group_resource ===
                                  formEnvironment.getFieldValue(
                                    "uid_group_resource",
                                  ),
                              )
                              .map((item) => (
                                <Select.Option key={item.uid} value={item.uid}>
                                  {item.name_resource_environment}
                                </Select.Option>
                              ))}
                          </Select>
                        </Form.Item>
                      ) : (
                        <Form.Item
                          name="id_enviroment"
                          label="Tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tài nguyên",
                            },
                          ]}
                        >
                          <Select
                            mode="multiple"
                            placeholder="Chọn tài nguyên"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                          >
                            {[].map((item, i) => (
                              <Select.Option key={i} value={i}>
                                {item.name_resource_environment}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item
                    name="purpose"
                    label="Mục đích đăng ký"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn mục đích đăng ký",
                      },
                    ]}
                  >
                    <Input placeholder="Nhập mục đích đăng ký" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="time_start"
                    label="Thời gian bắt đầu"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn thời gian bắt đầu",
                      },
                    ]}
                  >
                    <SingleDateTimePicker
                      name="time_start"
                      placeholderText="Nhập thời gian bắt đầu"
                      required
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="time_end"
                    label="Thời gian kết thúc"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn thời gian kết thúc",
                      },
                    ]}
                  >
                    <SingleDateTimePicker
                      name="time_end"
                      placeholderText="Nhập thời gian kết thúc"
                      required
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_flow"
                    label="Người xét duyệt"
                    required={maxAnySelection > 0}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const selected = Array.isArray(value) ? value : [];
                          const selectedCount = selected.length;

                          if (maxAnySelection > 0) {
                            if (selectedCount === 0) {
                              return Promise.reject(
                                new Error(
                                  `Vui lòng chọn đủ ${maxAnySelection} người xét duyệt (do có ${maxAnySelection} bước "Nhân viên bất kỳ")`,
                                ),
                              );
                            }
                            if (selectedCount < maxAnySelection) {
                              return Promise.reject(
                                new Error(
                                  `Còn thiếu ${
                                    maxAnySelection - selectedCount
                                  } người. Vui lòng chọn đủ ${maxAnySelection} người`,
                                ),
                              );
                            }
                            if (selectedCount > maxAnySelection) {
                              return Promise.reject(
                                new Error(
                                  `Chỉ được chọn tối đa ${maxAnySelection} người (vượt quá số bước "Nhân viên bất kỳ")`,
                                ),
                              );
                            }
                          }

                          // Nếu không có "any" → không bắt buộc nhập (vì đã có người trong flow)
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người xét duyệt"
                      allowClear
                      showSearch
                      disabled={maxAnySelection === 0}
                      // disabled={!allowSetupFlow}
                      optionLabelProp="label"
                      // Giới hạn hiển thị tag (tùy chọn - nhìn đẹp hơn)
                      maxTagCount={
                        maxAnySelection > 0 ? maxAnySelection : undefined
                      }
                      maxTagTextLength={10}
                      filterOption={(input, option) => {
                        const item = optionsApproval.find(
                          (o) => o.ma_nv === option.value,
                        );
                        const searchText = `${item?.ten_phong_ban || ""} ${
                          item?.ten_nv
                        } ${item?.ma_nv}`.toLowerCase();
                        return searchText.includes(input.toLowerCase());
                      }}
                      onChange={(value) => {
                        // Optional: cảnh báo ngay khi vượt quá (trước khi AntD chặn)
                        if (
                          maxAnySelection > 0 &&
                          value.length > maxAnySelection
                        ) {
                          messageApi.warning?.(
                            `Chỉ được chọn tối đa ${maxAnySelection} người do có bước "Nhân viên bất kỳ"`,
                          );
                        }
                      }}
                    >
                      {optionsApproval.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || "Chưa có PB"} - ${
                            item.ten_nv
                          }`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            <div>
                              <div>
                                {item.ten_phong_ban || "Không có phòng ban"}
                              </div>
                              <div className="tw-text-xs tw-text-gray-500">
                                {item.ten_nv} ({item.ma_nv})
                              </div>
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_department_participant"
                    label="Phòng ban tham gia"
                  >
                    <TreeSelect
                      showSearch
                      style={{ width: "100%" }}
                      styles={{
                        popup: {
                          root: { maxHeight: 400, overflow: "auto" },
                        },
                      }}
                      placeholder="Chọn phòng ban"
                      allowClear
                      treeDefaultExpandAll
                      filterTreeNode={(inputValue, treeNode) => {
                        // Tìm trong title của chính node đó
                        return treeNode.title
                          .toLowerCase()
                          .includes(inputValue.toLowerCase());
                      }}
                      treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                    >
                      {createTreeData(state.department).map((item) => (
                        <TreeNode
                          value={item.value}
                          title={item.title}
                          key={item.key}
                        >
                          {item.children.map((child) => (
                            <TreeNode
                              value={child.value}
                              title={child.title}
                              key={child.key}
                            />
                          ))}
                        </TreeNode>
                      ))}
                    </TreeSelect>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_participant"
                    label="Người tham gia"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người tham gia"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_notification"
                    label="Người nhận thông báo"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người nhận thông báo"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_manager"
                    label="Người quản lý"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người quản lý"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev.uid_group_resource !== curr.uid_group_resource
                  }
                >
                  {({ getFieldValue }) => {
                    const selectedUid = getFieldValue("uid_group_resource");
                    const selectedResource = state.groupResources.find(
                      (gr) => gr.uid === selectedUid,
                    );

                    return (
                      <>
                        {selectedResource?.field_configs?.length > 0 && (
                          <Col span={24}>
                            <Row gutter={16}>
                              {selectedResource.field_configs.map((field) => (
                                <Col xs={24} sm={24} md={12} key={field.key}>
                                  <Form.Item
                                    name={[
                                      "expansionFieldValues",
                                      field.ticker || field.label,
                                    ]}
                                    label={field.ticker || field.label}
                                    rules={
                                      field.required
                                        ? [
                                            {
                                              required: true,
                                              message: `Vui lòng nhập ${
                                                field.ticker || field.label
                                              }`,
                                            },
                                          ]
                                        : []
                                    }
                                    {...(field.type === 6
                                      ? {
                                          valuePropName: "fileList",
                                          getValueFromEvent: (e) =>
                                            Array.isArray(e) ? e : e?.fileList,
                                        }
                                      : {})}
                                  >
                                    {(() => {
                                      switch (field.type) {
                                        case 0: // Kiểu chữ (một dòng)
                                          return (
                                            <Input
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                        case 1: // Kiểu chữ (nhiều dòng)
                                          return (
                                            <Input.TextArea
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                        case 2: // Kiểu số
                                          return (
                                            <InputNumber
                                              style={{ width: "100%" }}
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                              min={field.minValue}
                                              max={field.maxValue}
                                            />
                                          );
                                        case 3: // Kiểu ngày tháng
                                          return (
                                            <DatePicker
                                              style={{ width: "100%" }}
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              format="DD/MM/YYYY"
                                            />
                                          );
                                        case 4: // Kiểu ngày giờ
                                          return (
                                            <DatePicker
                                              showTime
                                              style={{ width: "100%" }}
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              format="DD/MM/YYYY HH:mm"
                                            />
                                          );
                                        case 5: // Kiểu lựa chọn
                                          return (
                                            <Select
                                              mode={
                                                field.allowMultiple
                                                  ? "multiple"
                                                  : undefined
                                              }
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              options={field.options || []}
                                            />
                                          );

                                        default:
                                          return (
                                            <Input
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                      }
                                    })()}
                                  </Form.Item>
                                </Col>
                              ))}
                            </Row>
                          </Col>
                        )}
                      </>
                    );
                  }}
                </Form.Item>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item name="anonymous" label="" valuePropName="checked">
                    <Checkbox>Riêng tư</Checkbox>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item name="note" label="Ghi chú">
                    <Input.TextArea rows={4} placeholder="ghi chú" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default FormEnvironment;
