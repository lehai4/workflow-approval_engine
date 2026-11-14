import { SingleDateTimePicker } from "@/components/common/DatePickerComponents";
import TinyEditor from "@/components/common/TextEditor";
import TimelineApprovers from "@/components/common/TimelineApprovers";
import {
  CloseOutlined,
  SaveOutlined,
  SendOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  TreeSelect,
  Typography,
  Upload,
  Tag,
} from "antd";
import { TreeNode } from "antd/es/tree-select";

const DrawerFormProposal = ({
  open,
  handleCloseDrawer,
  title,
  // handleSendProposalReality,
  formAddProposalReality,
  onFinish,
  // handleSaveDraft,
  setActionType,
  handleProposalTypeChange,
  optionsApproval = [],
  optionsProposalType,
  createTreeData,
  allowSetupFlow,
  department,
  syncNV,
  itemConfigProposal,
  options,
  dropdownRender,
  dynamicFields,
  beforeUpload,
  fileList,
  setFileList,
  props,
  fileListvs2,
  timelineApprovers,
  maxAnySelection,
  uploadingCount,
  fixedConfigPeople,
  children,
}) => {
  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component
  return (
    <>
      {contextHolder}
      {/* Drawer đóng thì form chưa có <Form> nào gắn vào, trong khi trang cha vẫn gọi setFieldsValue /
          resetFields (vd sao chép đề xuất trước khi mở drawer) -> giữ instance kết nối bằng một Form rỗng
          không render DOM. Chỉ một trong hai Form tồn tại tại một thời điểm. */}
      {!open && <Form form={formAddProposalReality} component={false} />}
      {open && (
        <Drawer
          open={open}
          onClose={handleCloseDrawer}
          closable={false}
          placement="top"
          width="100vw"
          style={{
            height: "100dvh",
            backgroundColor: "rgb(243 244 246)",
          }}
          destroyOnClose={true}
          title={title}
          extra={
            <div className="tw-hidden md:tw-flex tw-flex-row tw-items-end tw-gap-x-2">
              <Button
                icon={<SendOutlined />}
                type="primary"
                htmlType="submit"
                onClick={() => {
                  formAddProposalReality.submit();
                  setActionType("send");
                }}
                // Khóa nếu đang có ít nhất 1 file đang upload
                disabled={uploadingCount > 0}
              >
                Gửi
              </Button>
              <Button
                type="default"
                icon={<SaveOutlined />}
                className="tw-bg-green-500 tw-text-white"
                htmlType="submit"
                onClick={() => {
                  formAddProposalReality.submit();
                  setActionType("draft");
                }}
                // Khóa nếu đang có ít nhất 1 file đang upload
                disabled={uploadingCount > 0}
              >
                Lưu nháp
              </Button>
              <Button icon={<CloseOutlined />} onClick={handleCloseDrawer}>
                Đóng
              </Button>
            </div>
          }
          footer={
            <div className="tw-flex md:tw-hidden tw-gap-2 tw-justify-end tw-p-2 tw-pb-[calc(env(safe-area-inset-bottom)+8px)]">
              <Button
                onClick={handleCloseDrawer}
                className="tw-flex-1 sm:tw-flex-none"
              >
                Đóng
              </Button>

              <Button
                type="default"
                icon={<SaveOutlined />}
                className="tw-bg-green-500 tw-text-white hover:tw-bg-green-600 tw-flex-1 sm:tw-flex-none"
                onClick={() => {
                  setActionType("draft");
                  formAddProposalReality.submit();
                }}
                // Khóa nếu đang có ít nhất 1 file đang upload
                disabled={uploadingCount > 0}
              >
                Lưu nháp
              </Button>

              <Button
                type="primary"
                icon={<SendOutlined />}
                className="tw-flex-1 sm:tw-flex-none"
                onClick={() => {
                  setActionType("send");
                  formAddProposalReality.submit();
                }}
                // Khóa nếu đang có ít nhất 1 file đang upload
                disabled={uploadingCount > 0}
              >
                Gửi
              </Button>
            </div>
          }
        >
          <div className="tw-grid tw-grid-cols-12 tw-gap-4">
            <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-8 lg:tw-col-span-8">
              <Card title="THÔNG TIN ĐỀ XUẤT">
                <Form
                  layout="vertical"
                  form={formAddProposalReality}
                  onFinish={onFinish}
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="id_proposal_type"
                        label="Loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn loại đề xuất",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Chọn loại đề xuất"
                          onChange={handleProposalTypeChange}
                          allowClear
                          showSearch
                          optionFilterProp="children"
                        >
                          {optionsProposalType.map((item) => (
                            <Select.Option value={item.uid} key={item.uid}>
                              {item.name_proposal_type}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="name_proposal_reality"
                        label="Tên đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập tên đề xuất",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập tên đề xuất" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item name="name_project" label="Dự án">
                        <Select placeholder="Chọn dự án" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="id_department"
                        label="Phòng ban"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn phòng ban",
                          },
                        ]}
                      >
                        <TreeSelect
                          showSearch
                          style={{ width: "100%" }}
                          styles={{
                            popup: {
                              root: {
                                maxHeight: 400,
                                overflow: "auto",
                              },
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
                          {createTreeData(department ? department : []).map(
                            (item) => (
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
                            ),
                          )}
                        </TreeSelect>
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
                              const selected = Array.isArray(value)
                                ? value
                                : [];
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
                          disabled={!allowSetupFlow}
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

                      <Form.Item
                        hidden
                        name="id_group_people_flow_disable"
                        label="Người xét duyệt"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Chọn người xét duyệt"
                          allowClear
                          showSearch
                          disabled={!allowSetupFlow}
                          optionLabelProp="label"
                          filterOption={(input, option) => {
                            const item = optionsApproval.find(
                              (o) => o.ma_nv === option.value,
                            );
                            const searchText = `${item?.ten_phong_ban || ""} ${
                              item?.ten_nv
                            } ${item?.ma_nv}`.toLowerCase();
                            return searchText.includes(input.toLowerCase());
                          }}
                        >
                          {optionsApproval.map((item) => (
                            <Select.Option
                              key={item.ma_nv}
                              value={item.ma_nv}
                              label={`${item.ten_phong_ban || ""} (${
                                item.ten_nv
                              })`}
                            >
                              <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                                <Avatar size={24} icon={<UserOutlined />} />
                                <div>
                                  <div>
                                    {item.ten_phong_ban || "Không có phòng ban"}
                                  </div>
                                  <div className="tw-text-xs tw-text-gray-500">
                                    {item.ten_nv} ({item.ma_nv})
                                    {!item.is_flow && (
                                      <span className="tw-ml-2 tw-text-orange-600">
                                        ⚠️ Không áp dụng flow
                                      </span>
                                    )}
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
                        name="id_group_people_follow"
                        label="Người theo dõi"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Chọn người theo dõi"
                          allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                          showSearch
                          optionLabelProp="label"
                          // 1. Logic chặn xóa những người cố định
                          onChange={(currentValues) => {
                            // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                            const finalValues = [
                              ...new Set([
                                ...fixedConfigPeople.id_group_people_follow,
                                ...currentValues,
                              ]),
                            ];
                            formAddProposalReality.setFieldsValue({
                              id_group_people_follow: finalValues,
                            });
                          }}
                          // Tùy chỉnh hiển thị Tag
                          tagRender={(props) => {
                            const { label, value, closable, onClose } = props;
                            const isFixed =
                              fixedConfigPeople.id_group_people_follow.includes(
                                value,
                              );

                            return (
                              <Tag
                                closable={isFixed ? false : closable}
                                onClose={onClose}
                                style={{
                                  fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                  display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                  alignItems: "center",

                                  // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                  margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                  padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                  // ----------------------------------------

                                  border: isFixed
                                    ? "1px solid #f5222d"
                                    : "1px solid #d9d9d9",
                                  backgroundColor: isFixed
                                    ? "#fff1f0"
                                    : "rgba(0,0,0,0.06)",
                                  borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                  height: "auto",
                                  lineHeight: "22px", // Cân bằng chiều cao chữ
                                }}
                              >
                                {label}
                              </Tag>
                            );
                          }}
                          filterOption={(input, option) => {
                            const item = optionsApproval.find(
                              (o) => o.ma_nv === option.value,
                            );
                            const searchText =
                              `${item?.ten_phong_ban || ""} ${item?.ten_nv} ${item?.ma_nv}`.toLowerCase();
                            return searchText.includes(input.toLowerCase());
                          }}
                        >
                          {syncNV.map((item) => (
                            <Select.Option
                              key={item.ma_nv}
                              value={item.ma_nv}
                              label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                            >
                              {/* ... nội dung option giữ nguyên như code của bạn ... */}
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
                    {itemConfigProposal && (
                      <>
                        <Col xs={24} sm={24} md={12}>
                          <Form.Item
                            name="id_group_people_notification"
                            label="Người nhận thông báo"
                          >
                            <Select
                              mode="multiple"
                              placeholder="Chọn người nhận thông báo"
                              allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                              showSearch
                              optionLabelProp="label"
                              // 1. Logic chặn xóa những người cố định
                              onChange={(currentValues) => {
                                // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                                const finalValues = [
                                  ...new Set([
                                    ...fixedConfigPeople.id_group_people_notification,
                                    ...currentValues,
                                  ]),
                                ];
                                formAddProposalReality.setFieldsValue({
                                  id_group_people_notification: finalValues,
                                });
                              }}
                              // Tùy chỉnh hiển thị Tag
                              tagRender={(props) => {
                                const { label, value, closable, onClose } =
                                  props;
                                const isFixed =
                                  fixedConfigPeople.id_group_people_notification.includes(
                                    value,
                                  );

                                return (
                                  <Tag
                                    closable={isFixed ? false : closable}
                                    onClose={onClose}
                                    style={{
                                      fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                      display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                      alignItems: "center",

                                      // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                      margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                      padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                      // ----------------------------------------

                                      border: isFixed
                                        ? "1px solid #f5222d"
                                        : "1px solid #d9d9d9",
                                      backgroundColor: isFixed
                                        ? "#fff1f0"
                                        : "rgba(0,0,0,0.06)",
                                      borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                      height: "auto",
                                      lineHeight: "22px", // Cân bằng chiều cao chữ
                                    }}
                                  >
                                    {label}
                                  </Tag>
                                );
                              }}
                              filterOption={(input, option) => {
                                const item = optionsApproval.find(
                                  (o) => o.ma_nv === option.value,
                                );
                                const searchText =
                                  `${item?.ten_phong_ban || ""} ${item?.ten_nv} ${item?.ma_nv}`.toLowerCase();
                                return searchText.includes(input.toLowerCase());
                              }}
                            >
                              {syncNV.map((item) => (
                                <Select.Option
                                  key={item.ma_nv}
                                  value={item.ma_nv}
                                  label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                                >
                                  {/* ... nội dung option giữ nguyên như code của bạn ... */}
                                  <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                                    <Avatar size={24} icon={<UserOutlined />} />
                                    <div>
                                      <div>
                                        {item.ten_phong_ban ||
                                          "Không có phòng ban"}
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
                          <Form.Item shouldUpdate>
                            {({ getFieldValue }) => {
                              const groupData = getFieldValue(
                                "is_group_people_perform",
                              );

                              return groupData ? (
                                <Form.Item
                                  name="id_group_people_perform"
                                  label="Người thực hiện"
                                >
                                  <Select
                                    mode="multiple"
                                    placeholder="Chọn người thực hiện"
                                    allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                                    showSearch
                                    optionLabelProp="label"
                                    // 1. Logic chặn xóa những người cố định
                                    onChange={(currentValues) => {
                                      // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                                      const finalValues = [
                                        ...new Set([
                                          ...fixedConfigPeople.id_group_people_perform,
                                          ...currentValues,
                                        ]),
                                      ];
                                      formAddProposalReality.setFieldsValue({
                                        id_group_people_perform: finalValues,
                                      });
                                    }}
                                    // Tùy chỉnh hiển thị Tag
                                    tagRender={(props) => {
                                      const {
                                        label,
                                        value,
                                        closable,
                                        onClose,
                                      } = props;
                                      const isFixed =
                                        fixedConfigPeople.id_group_people_perform.includes(
                                          value,
                                        );

                                      return (
                                        <Tag
                                          closable={isFixed ? false : closable}
                                          onClose={onClose}
                                          style={{
                                            fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                            display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                            alignItems: "center",

                                            // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                            margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                            padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                            // ----------------------------------------

                                            border: isFixed
                                              ? "1px solid #f5222d"
                                              : "1px solid #d9d9d9",
                                            backgroundColor: isFixed
                                              ? "#fff1f0"
                                              : "rgba(0,0,0,0.06)",
                                            borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                            height: "auto",
                                            lineHeight: "22px", // Cân bằng chiều cao chữ
                                          }}
                                        >
                                          {label}
                                        </Tag>
                                      );
                                    }}
                                    filterOption={(input, option) => {
                                      const item = optionsApproval.find(
                                        (o) => o.ma_nv === option.value,
                                      );
                                      const searchText =
                                        `${item?.ten_phong_ban || ""} ${item?.ten_nv} ${item?.ma_nv}`.toLowerCase();
                                      return searchText.includes(
                                        input.toLowerCase(),
                                      );
                                    }}
                                  >
                                    {syncNV.map((item) => (
                                      <Select.Option
                                        key={item.ma_nv}
                                        value={item.ma_nv}
                                        label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                                      >
                                        {/* ... nội dung option giữ nguyên như code của bạn ... */}
                                        <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                                          <Avatar
                                            size={24}
                                            icon={<UserOutlined />}
                                          />
                                          <div>
                                            <div>
                                              {item.ten_phong_ban ||
                                                "Không có phòng ban"}
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
                              ) : null;
                            }}
                          </Form.Item>
                        </Col>
                      </>
                    )}
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="desired_approval_period"
                        label="Thời hạn duyệt mong muốn"
                      >
                        <SingleDateTimePicker
                          name="approval_period_as_prescribed"
                          placeholderText="Nhập thời hạn duyệt mong muốn"
                          required
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="approval_period_as_prescribed"
                        label="Thời hạn duyệt theo quy định"
                      >
                        <SingleDateTimePicker
                          name="approval_period_as_prescribed"
                          placeholderText="Nhập thời hạn duyệt theo quy định"
                          required
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <Form.Item
                        name="id_link_proposal"
                        label="Liên kết với đề xuất"
                      >
                        <Select
                          placeholder="Chọn đề xuất liên kết"
                          popupRender={dropdownRender}
                          mode="multiple"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                        >
                          {options.map((item) => (
                            <Select.Option key={item.value} value={item.value}>
                              {item.label}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {dynamicFields.length > 0 && (
                      <Col span={24}>
                        <Row gutter={16}>
                          {dynamicFields.map((field) => (
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
                                    case 6: // Kiểu đính kèm
                                      return (
                                        <Upload
                                          beforeUpload={beforeUpload}
                                          fileList={fileList}
                                          onRemove={() => setFileList([])} // Xóa file khi nhấn remove
                                          maxCount={1}
                                          text
                                          listType="text"
                                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                                        >
                                          <Button icon={<UploadOutlined />}>
                                            Đính kèm tệp
                                          </Button>
                                        </Upload>
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
                    <Col xs={24} sm={24} md={24}>
                      <div className="tw-my-2">Nội dung:</div>
                      <TinyEditor
                        openDrawer={open}
                        form={formAddProposalReality}
                      />
                    </Col>
                    <Col xs={24} sm={24} md={24}>
                      <Upload {...props} multiple fileList={fileListvs2}>
                        <Button icon={<UploadOutlined />}>Chọn tệp</Button>
                      </Upload>
                    </Col>
                  </Row>
                </Form>
              </Card>
            </div>
            <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-4 lg:tw-col-span-4">
              <Card title="QUY TRÌNH XÉT DUYỆT">
                {formAddProposalReality.getFieldValue("id_proposal_type") && (
                  <>
                    <div>
                      <Typography.Text strong>QUY TRÌNH</Typography.Text>
                      <div className="tw-text-blue-500 tw-my-2">
                        {formAddProposalReality.getFieldValue("type")}
                      </div>
                    </div>
                    <Divider />
                    <div>
                      <Typography.Text strong>NGƯỜI XÉT DUYỆT</Typography.Text>
                      <div className="tw-mt-8">
                        <TimelineApprovers approvers={timelineApprovers} />
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
          {/* Drawer dùng để chọn loại đề xuất để liên kết */}
          {children}
        </Drawer>
      )}
    </>
  );
};

export default DrawerFormProposal;
