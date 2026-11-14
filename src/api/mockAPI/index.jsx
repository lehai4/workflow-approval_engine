import {
  BulbOutlined,
  CalendarOutlined,
  CopyrightOutlined,
  SettingFilled,
  SettingOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

export const officeItems = [
  {
    type: "OFFICE",
    items: [
      {
        name: "Đăng ký sử dụng tài nguyên",
        id: 0,
        icon: CalendarOutlined,
        path: "booking",
      },
      {
        name: "Quản trị phân hệ OFFICE",
        id: 1,
        icon: SettingOutlined,
        path: "manager",
        children: [
          {
            name: "Cấu hình",
            id: 10,
            icon: SettingFilled,
            path: "config-request",
            children: [],
          },
          {
            name: "Danh mục",
            id: 11,
            icon: UnorderedListOutlined,
            path: "worktypes",
          },
          {
            name: "Phân quyền",
            id: 12,
            icon: CopyrightOutlined,
            children: [
              {
                name: "Người dùng",
                id: 120,
                icon: "",
                path: "right",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "WORK",
    items: [
      {
        name: "Đề xuất và phê duyệt nội bộ",
        id: 0,
        icon: BulbOutlined,
        path: "request",
      },
      {
        name: "Quản trị phân hệ WORK",
        id: 1,
        icon: SettingOutlined,
        path: "task-manager",
        children: [
          {
            name: "Cấu hình",
            id: 10,
            icon: SettingFilled,
            path: "config-request",
            children: [],
          },
          {
            name: "Danh mục",
            id: 11,
            icon: UnorderedListOutlined,
            path: "worktypes",
          },
        ],
      },
    ],
  },
  {
    type: "ADMIN",
    items: [
      {
        name: "Quản lý người dùng",
        id: 0,
        icon: UserOutlined,
        path: "usersettings",
      },
      {
        name: "Phân quyền quản trị",
        id: 2,
        icon: SettingFilled,
        path: "rols",
      },
    ],
  },
];

//Kiểu dữ liệu cho cấu hình đề xuất
export const typeOf = [
  {
    id: 0,
    name: "Kiểu chữ (một dòng)",
  },
  {
    id: 1,
    name: "Kiểu chữ (nhiều dòng)",
  },
  {
    id: 2,
    name: "Kiểu số",
  },
  {
    id: 3,
    name: "Kiểu ngày tháng",
  },
  {
    id: 4,
    name: "Kiểu ngày giờ",
  },
  {
    id: 5,
    name: "Kiểu lựa chọn",
  },
  {
    id: 6,
    name: "Kiểu đính kèm",
  },
  {
    id: 7,
    name: "Kiểu liên kết",
  },
];

//Kiểu dữ liệu cho cấu hình loại tài nguyên

export const typeOfRE = [
  {
    id: 0,
    name: "Kiểu chữ (một dòng)",
    type: "input",
  },
  {
    id: 1,
    name: "Kiểu chữ (nhiều dòng)",
    type: "textarea",
  },
  {
    id: 2,
    name: "Kiểu số",
    type: "number",
  },
  {
    id: 3,
    name: "Kiểu ngày tháng",
    type: "date",
  },
  {
    id: 4,
    name: "Kiểu ngày giờ",
    type: "date",
  },
  {
    id: 5,
    name: "Kiểu lựa chọn",
    type: "select",
  },
];

//Loại quy trình xét duyệt
export const optionsFlow = [
  {
    id: 0,
    name: "Chỉ cần một người duyệt",
  },
  // {
  //   id: 1,
  //   name: "Cần duyệt đồng thời",
  // },
  {
    id: 2,
    name: "Duyệt theo trình tự",
  },
];

//Loại quy trình xét duyệt đăng ký tài nguyên
export const optionsFlowResourceEnvironment = [
  {
    id: 0,
    name: "Không cần người xét duyệt",
  },
  {
    id: 1,
    name: "Duyệt theo trình tự",
  },
];

//breakpoint for RangePicker
// export const rangePresets = [
//   { label: "Hôm qua", value: [dayjs().add(-1, "d"), dayjs().add(-1, "d")] },
//   { label: "Hôm nay", value: [dayjs(), dayjs()] },
//   {
//     label: "Tuần trước",
//     value: [
//       dayjs().startOf("week").add(-1, "week"),
//       dayjs().startOf("week").add(-1, "day"),
//     ],
//   },
//   {
//     label: "Tuần này",
//     value: [dayjs().startOf("isoWeek"), dayjs().endOf("isoWeek")],
//   },
//   {
//     label: "Tháng trước",
//     value: [
//       dayjs().subtract(1, "month").startOf("month"),
//       dayjs().subtract(1, "month").endOf("month"),
//     ],
//   },
//   {
//     label: "Tháng này",
//     value: [dayjs().startOf("month"), dayjs().endOf("month")],
//   },
// ];

export const rangePresets = [
  {
    label: "Hôm qua",
    value: [
      dayjs().subtract(1, "d").startOf("day"),
      dayjs().subtract(1, "d").endOf("day"),
    ],
  },
  {
    label: "Hôm nay",
    value: [dayjs().startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "Tuần trước",
    value: [
      dayjs().subtract(1, "week").startOf("week"),
      dayjs().subtract(1, "week").endOf("week"),
    ],
  },
  {
    label: "Tuần này",
    // Dùng "week" để khớp với giao diện lịch hiển thị Chủ Nhật là đầu tuần
    value: [dayjs().startOf("week"), dayjs().endOf("week")],
  },
  {
    label: "Tháng trước",
    value: [
      dayjs().subtract(1, "month").startOf("month"),
      dayjs().subtract(1, "month").endOf("month"),
    ],
  },
  {
    label: "Tháng này",
    value: [dayjs().startOf("month"), dayjs().endOf("month")],
  },
];
