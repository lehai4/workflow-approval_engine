import { UserOutlined } from "@ant-design/icons";
import { Avatar } from "antd";
import { Timeline } from "antd";
const TimelineApprovers = ({ approvers }) => {
  return (
    <Timeline
      items={approvers.map((stepItem, index) => ({
        dot: (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#1890ff",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 14,
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              verticalAlign: "middle", // Căn giữa theo chiều dọc
            }}
          >
            {index + 1}
          </div>
        ),
        children: (
          <div className="tw-relative tw-ml-3">
            {/* Mũi tên */}
            <div
              className="tw-absolute tw-left-[-8px] tw-top-1/3 tw-transform tw--translate-y-1/2"
              style={{
                width: 0,
                height: 0,
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                borderRight: "8px solid #d9d9d9",
              }}
            />
            {/* Danh sách người duyệt */}
            <div className="tw-flex tw-flex-col tw-gap-2">
              {stepItem?.approvers?.map((approver, idx) => (
                <div
                  key={idx}
                  className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-100 tw-p-2 tw-rounded-md hover:tw-opacity-80 tw-transition-all tw-duration-200"
                >
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ backgroundColor: "#ccc", flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }} className="tw-uppercase">
                      {approver.name === "Nhân viên bất kỳ"
                        ? approver.name
                        : approver.department || "Không rõ"}
                    </span>{" "}
                    {approver.name !== "Nhân viên bất kỳ" &&
                      `(${approver.name})`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      }))}
    />
  );
};

export default TimelineApprovers;
