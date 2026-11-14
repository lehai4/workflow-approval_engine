// // vs3
// import {
//   CheckCircleFilled,
//   ClockCircleOutlined,
//   CloseCircleFilled,
//   UserOutlined,
// } from "@ant-design/icons";

// import { Avatar, Timeline, Typography } from "antd";
// import dayjs from "dayjs";

// const TimelineApproved = ({ approvers, syncNV }) => {
//   const timelineItems = approvers.map((item, index) => {
//     const isApproved = item.is_approval_flow === 1;
//     const isRejected = item.is_approval_flow === 3;

//     const statusColor = isApproved
//       ? "#1890ff"
//       : isRejected
//       ? "#ff4d4f"
//       : "#a0a0a0"; // Xanh / Đỏ / Xám

//     const nv = syncNV.find((nv) => nv.ma_nv === item.ma_nv);
//     const tenNV = nv?.ten_nv || "Không rõ tên";
//     const phongBan = nv?.ten_phong_ban || "Không rõ phòng ban";

//     return {
//       key: item.uid,
//       color: "gray",
//       dot: (
//         <div
//           className={`tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-white tw-font-bold tw-text-sm`}
//           style={{
//             width: 32,
//             height: 32,
//             borderRadius: "50%",
//             backgroundColor: statusColor,
//             color: "#fff",
//             fontWeight: "bold",
//             fontSize: 14,
//             marginTop: 10,
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//           }}
//         >
//           {index + 1}
//         </div>
//       ),

//       children: (
//         <div className="tw-relative tw-ml-3">
//           {/* Mũi tên nhỏ nối với dot */}
//           <div
//             className="tw-absolute tw-left-[-8px] tw-top-1/4 tw-transform tw--translate-y-1/2"
//             style={{
//               width: 0,
//               height: 0,
//               borderTop: "10px solid transparent",
//               borderBottom: "10px solid transparent",
//               borderRight: "8px solid #d9d9d9",
//             }}
//           />
//           {/* Nội dung box */}
//           <div className="tw-bg-white tw-rounded-md tw-shadow-md tw-p-4 tw-flex tw-justify-between tw-items-start tw-space-x-4">
//             <div className="tw-flex tw-items-start tw-space-x-3">
//               <Avatar
//                 size={40}
//                 src={item.avatarUrl || null}
//                 icon={!item.avatarUrl && <UserOutlined />}
//               />
//               <div>
//                 <Typography.Text strong>
//                   {phongBan} ({tenNV})
//                 </Typography.Text>
//                 {item.note && (
//                   <div className="tw-text-gray-500">{item.note}</div>
//                 )}
//                 <div className="tw-text-xs tw-text-gray-500">
//                   {item.created_at
//                     ? `${dayjs(item.created_at).format("DD/MM/YYYY, HH:mm")}`
//                     : ""}
//                 </div>
//               </div>
//             </div>
//             <div className="tw-text-xl tw-mt-1">
//               {isApproved ? (
//                 <CheckCircleFilled className="tw-text-blue-500" />
//               ) : isRejected ? (
//                 <CloseCircleFilled className="tw-text-red-500" />
//               ) : (
//                 <ClockCircleOutlined className="tw-text-gray-400" />
//               )}
//             </div>
//           </div>
//         </div>
//       ),
//     };
//   });

//   return <Timeline className="tw-ml-4 tw-mt-6" items={timelineItems} />;
// };

// export default TimelineApproved;

// // vs2
// import {
//   CheckCircleFilled,
//   ClockCircleOutlined,
//   CloseCircleFilled,
//   UserOutlined,
// } from "@ant-design/icons";
// import { Avatar, Timeline, Typography } from "antd";
// import dayjs from "dayjs";

// const TimelineApproved = ({ approvers, syncNV }) => {
//   // Sắp xếp approvers theo step_flow (và giữ thứ tự trong mảng gốc nếu cần)
//   const sortedApprovers = [...approvers].sort(
//     (a, b) => a.step_flow - b.step_flow
//   );

//   // Nhóm theo step_flow
//   const grouped = sortedApprovers.reduce((acc, item) => {
//     const step = item.step_flow;
//     if (!acc[step]) acc[step] = [];
//     acc[step].push(item);
//     return acc;
//   }, {});

//   // Tạo danh sách timeline items theo nhóm
//   const timelineItems = Object.entries(grouped).flatMap(
//     ([step, items], groupIndex) => {
//       return items.map((item, idx) => {
//         const isApproved = item.is_approval_flow === 1;
//         const isRejected = item.is_approval_flow === 3;

//         const statusColor = isApproved
//           ? "#1890ff"
//           : isRejected
//           ? "#ff4d4f"
//           : "#a0a0a0";

//         const nv = syncNV.find((nv) => nv.ma_nv === item.ma_nv);
//         const tenNV = nv?.ten_nv || "Không rõ tên";
//         const phongBan = nv?.ten_phong_ban || "Không rõ phòng ban";

//         // Chỉ hiển thị số ở người đầu tiên của nhóm
//         const showStepNumber = idx === 0;

//         return {
//           key: item.uid,
//           color: "gray",
//           dot: showStepNumber ? (
//             <div
//               className="tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-white tw-font-bold tw-text-sm"
//               style={{
//                 width: 32,
//                 height: 32,
//                 backgroundColor: statusColor,
//                 color: "#fff",
//                 fontWeight: "bold",
//                 fontSize: 14,
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               {groupIndex + 1}
//             </div>
//           ) : (
//             // Không có số -> dùng dot tròn nhỏ hơn hoặc ẩn
//             <div
//               style={{
//                 width: 12,
//                 height: 12,
//                 backgroundColor: statusColor,
//                 borderRadius: "50%",
//                 marginLeft: 10,
//                 marginTop: 16,
//               }}
//             />
//           ),

//           children: (
//             <div className="tw-relative tw-ml-3">
//               {/* Mũi tên nhỏ nối với dot */}
//               <div
//                 className="tw-absolute tw-left-[-8px] tw-top-1/4 tw-transform tw--translate-y-1/2"
//                 style={{
//                   width: 0,
//                   height: 0,
//                   borderTop: "10px solid transparent",
//                   borderBottom: "10px solid transparent",
//                   borderRight: "8px solid #d9d9d9",
//                 }}
//               />
//               {/* Nội dung box */}
//               <div
//                 className="tw-bg-white tw-rounded-md tw-shadow-md tw-p-4 tw-flex tw-justify-between tw-items-start tw-space-x-4"
//                 style={{
//                   // Thụt vào nếu không phải người đầu nhóm
//                   marginLeft: showStepNumber ? 0 : 20,
//                 }}
//               >
//                 <div className="tw-flex tw-items-start tw-space-x-3">
//                   <Avatar
//                     size={40}
//                     src={item.avatarUrl || null}
//                     icon={!item.avatarUrl && <UserOutlined />}
//                   />
//                   <div>
//                     <Typography.Text strong>
//                       {phongBan} ({tenNV})
//                     </Typography.Text>
//                     {item.note && (
//                       <div className="tw-text-gray-500">{item.note}</div>
//                     )}
//                     <div className="tw-text-xs tw-text-gray-500">
//                       {item.created_at
//                         ? dayjs(item.created_at).format("DD/MM/YYYY, HH:mm")
//                         : ""}
//                     </div>
//                   </div>
//                 </div>
//                 <div className="tw-text-xl tw-mt-1">
//                   {isApproved ? (
//                     <CheckCircleFilled className="tw-text-blue-500" />
//                   ) : isRejected ? (
//                     <CloseCircleFilled className="tw-text-red-500" />
//                   ) : (
//                     <ClockCircleOutlined className="tw-text-gray-400" />
//                   )}
//                 </div>
//               </div>
//             </div>
//           ),
//         };
//       });
//     }
//   );

//   return <Timeline className="tw-ml-4 tw-mt-6" items={timelineItems} />;
// };

// export default TimelineApproved;

// // vs3
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Timeline, Typography } from "antd";
import dayjs from "dayjs";

const TimelineApproved = ({ approvers, syncNV }) => {
  // Sắp xếp theo step_flow
  const sortedApprovers = [...approvers].sort(
    (a, b) => a.step_flow - b.step_flow
  );

  // Nhóm theo step_flow
  const grouped = sortedApprovers.reduce((acc, item) => {
    const step = item.step_flow;
    if (!acc[step]) acc[step] = [];
    acc[step].push(item);
    return acc;
  }, {});

  const timelineItems = Object.entries(grouped).map(
    ([step, items], groupIndex) => {
      const firstItem = items[0];
      const nvFirst = syncNV.find((nv) => nv.ma_nv === firstItem.ma_nv);
      const phongBan = nvFirst?.ten_phong_ban || "Không rõ phòng ban";

      // Kiểm tra trạng thái nhóm
      const hasApproved = items.some((i) => i.is_approval_flow === 1);
      const hasRejected = items.some((i) => i.is_approval_flow === 3);
      const isGroupApproved = hasApproved || hasRejected;

      const blockStatusColor = hasRejected
        ? "#ff4d4f"
        : hasApproved
        ? "#1890ff"
        : "#a0a0a0";

      return {
        key: step,
        color: "gray",
        dot: (
          <div
            className="tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-white tw-font-bold"
            style={{
              width: 32,
              height: 32,
              backgroundColor: blockStatusColor,
              color: "#fff",
              fontWeight: "bold",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {groupIndex + 1}
          </div>
        ),
        children: (
          <div className="tw-flex tw-items-start">
            {/* Mũi tên chỉ từ block vào step (giữa block) */}
            <div className="tw-flex tw-items-center" style={{ minHeight: 48 }}>
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "10px solid transparent",
                  borderBottom: "10px solid transparent",
                  borderRight: "10px solid #d9d9d9",
                  marginLeft: -2,
                  marginTop: "-20px",
                }}
              />
            </div>

            {/* Block thông tin người duyệt */}
            <div className="tw-flex-1 tw-bg-white tw-rounded-md tw-shadow-md tw-p-4 tw-space-y-3">
              {items.map((item) => {
                const nv = syncNV.find((n) => n.ma_nv === item.ma_nv);
                const tenNV = nv?.ten_nv || "Không rõ tên";
                const isApproved = item.is_approval_flow === 1;
                const isRejected = item.is_approval_flow === 3;
                const isPending = !isApproved && !isRejected;

                const showClock = isPending && !isGroupApproved;

                return (
                  <div
                    key={item.uid}
                    className="tw-flex tw-justify-between tw-items-start tw-space-x-3"
                  >
                    <div className="tw-flex tw-items-start tw-space-x-3 tw-flex-1">
                      <Avatar
                        size={36}
                        src={item.avatarUrl || null}
                        icon={!item.avatarUrl && <UserOutlined />}
                      />
                      <div className="tw-flex-1">
                        <Typography.Text strong>
                          {phongBan} ({tenNV})
                        </Typography.Text>
                        {item.delegated_from && (
                          <div className="tw-text-xs tw-mt-0.5" style={{ color: "#6250d6" }}>
                            {isPending ? "Đang duyệt thay" : "Duyệt thay"} cho{" "}
                            {syncNV.find((n) => n.ma_nv === item.delegated_from)?.ten_nv || item.delegated_from}
                          </div>
                        )}
                        {item.note && (
                          <div className="tw-text-sm tw-text-gray-500 tw-mt-1 tw-block tw-break-words tw-whitespace-pre-line">
                            {item.note}
                          </div>
                        )}
                        <div className="tw-text-xs tw-text-gray-400">
                          {item.created_at
                            ? dayjs(item.created_at).format("DD/MM/YYYY, HH:mm")
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="tw-text-xl">
                      {isApproved ? (
                        <CheckCircleFilled className="tw-text-blue-500" />
                      ) : isRejected ? (
                        <CloseCircleFilled className="tw-text-red-500" />
                      ) : showClock ? (
                        <ClockCircleOutlined className="tw-text-gray-400" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      };
    }
  );

  return <Timeline className="tw-ml-4 tw-mt-6" items={timelineItems} />;
};

export default TimelineApproved;
