import dayjs from "dayjs";

const DATE_FORMAT_DATE = "DD/MM/YYYY";
const DATE_FORMAT_DATETIME = "DD/MM/YYYY HH:mm";

//Dùng cho sửa / sao chép đề xuất
export const mapExpansionFieldsForEdit = (fields = []) => {
  return fields?.reduce(
    (acc, field) => {
      switch (field.type) {
        case 3: // Date (ngày)
          acc[field.label] = field.value
            ? dayjs(field.value, DATE_FORMAT_DATE)
            : null;
          break;
        case 4: // DateTime (ngày giờ)
          acc[field.label] = field.value
            ? dayjs(field.value, DATE_FORMAT_DATETIME)
            : null;
          break;
        case 6: // File đính kèm
          if (Array.isArray(field.value) && field.value.length > 0) {
            const fileListItems = field.value.map((fileData) => ({
              uid: fileData.id,
              id: fileData.id,
              name: fileData.filename || "unknown.jpg",
              filename: fileData.filename,
              status: "done",
              url: fileData.url || "",
            }));
            acc[field.label] = fileListItems;
            acc.fileList = [...(acc.fileList || []), ...fileListItems];
          } else {
            acc[field.label] = [];
          }
          break;
        default:
          acc[field.label] = field.value;
      }
      return acc;
    },
    { fileList: [] }
  );
};

// Hàm tạo treeData từ dữ liệu phòng ban sử dụng
export const createTreeData = (data) => {
  const treeData = [];
  const companyMap = new Map();

  data.forEach((item) => {
    const { ten_cong_ty, ten_phong_ban, id, id_company } = item;
    if (!ten_cong_ty || !id_company) return;

    const companyKey = `${ten_cong_ty}-${id_company}`
      .toLowerCase()
      .replace(/ /g, "_");
    if (!companyMap.has(companyKey)) {
      companyMap.set(companyKey, {
        title: ten_cong_ty,
        value: companyKey, // Sử dụng companyKey làm value để đảm bảo duy nhất
        key: companyKey,
        children: [],
      });
    }
    if (ten_phong_ban) {
      const departmentKey = `${id_company}-${id}`;
      companyMap.get(companyKey).children.push({
        title: ten_phong_ban,
        value: departmentKey,
        key: departmentKey,
      });
    }
  });

  companyMap.forEach((value) => treeData.push(value));
  return treeData;
};

// // Import icons từ Ant Design
// import {
//   CalendarOutlined,
//   SettingOutlined,
//   SettingFilled,
//   UnorderedListOutlined,
//   CopyrightOutlined,
//   BulbOutlined,
//   UserOutlined,
// } from "@ant-design/icons";

// // Map từ name (hoặc code) sang details (id, icon, path, children) dựa trên mock gốc
// const mockMap = {
//   "Đăng ký tài nguyên": {
//     // Hoặc dùng regex để match gần đúng nếu name từ API không chính xác
//     id: 0,
//     icon: CalendarOutlined,
//     path: "booking",
//     children: [], // Không có children trong mock
//   },
//   "Quản trị phân hệ OFFICE": {
//     id: 1,
//     icon: SettingOutlined,
//     path: "manager",
//     children: [
//       {
//         name: "Cấu hình",
//         id: 10,
//         icon: SettingFilled,
//         path: "config-request",
//         children: [],
//       },
//       {
//         name: "Danh mục",
//         id: 11,
//         icon: UnorderedListOutlined,
//         path: "worktypes",
//         children: [], // Có thể thêm nếu cần
//       },
//       {
//         name: "Phân quyền",
//         id: 12,
//         icon: CopyrightOutlined,
//         children: [
//           {
//             name: "Người dùng",
//             id: 120,
//             icon: null, // Không có icon trong mock
//             path: "right",
//           },
//         ],
//       },
//     ],
//   },
//   "Đề xuất và phê duyệt nội bộ": {
//     id: 0,
//     icon: BulbOutlined,
//     path: "request",
//     children: [],
//   },
//   "Quản trị phân hệ WORK": {
//     id: 1,
//     icon: SettingOutlined,
//     path: "task-manager",
//     children: [
//       {
//         name: "Cấu hình",
//         id: 10,
//         icon: SettingFilled,
//         path: "config-request",
//         children: [],
//       },
//       {
//         name: "Danh mục",
//         id: 11,
//         icon: UnorderedListOutlined,
//         path: "worktypes",
//         children: [], // Có thể thêm
//       },
//     ],
//   },
//   "Quản lý người dùng": {
//     id: 0,
//     icon: UserOutlined,
//     path: "usersettings",
//     children: [],
//   },
//   // Thêm item khác nếu API có thêm, ví dụ 'Phân quyền quản trị': { id: 2, icon: SettingFilled, path: 'rols', children: [] }
// };

// // Hàm transform apiData thành officeItems format
// export const transformApiToOfficeItems = (apiData) => {
//   return Object.keys(apiData).map((type) => ({
//     type,
//     items: apiData[type].map((apiItem) => {
//       const matchedDetails = mockMap[apiItem.name] || {}; // Nếu không match, dùng default hoặc error
//       return {
//         name: apiItem.name,
//         code: apiItem.code, // Giữ nguyên từ API
//         id: matchedDetails.id ?? null,
//         icon: matchedDetails.icon ?? null,
//         path:
//           matchedDetails.path ??
//           apiItem.name.toLowerCase().replace(/\s+/g, "-"), // Default path nếu không match
//         children: matchedDetails.children ?? [], // Giữ children từ mock nếu match
//         // Nếu API có length, có thể fetch children động sau, nhưng tạm giữ vậy
//       };
//     }),
//   }));
// };

import {
  CalendarOutlined,
  SettingOutlined,
  SettingFilled,
  UnorderedListOutlined,
  CopyrightOutlined,
  BulbOutlined,
  UserOutlined,
  DashboardOutlined,
  AppstoreAddOutlined,
  BankOutlined,
  DashboardFilled,
  InfoCircleFilled,
  UserAddOutlined,
  PrinterOutlined,
  ProjectOutlined,
  CarryOutOutlined,
  BarChartOutlined,
  SwapOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";

const iconMap = {
  CalendarOutlined: CalendarOutlined,
  SettingOutlined: SettingOutlined,
  SettingFilled: SettingFilled,
  UnorderedListOutlined: UnorderedListOutlined,
  CopyrightOutlined: CopyrightOutlined,
  BulbOutlined: BulbOutlined,
  UserOutlined: UserOutlined,
  DashboardOutlined: DashboardOutlined,
  AppstoreAddOutlined: AppstoreAddOutlined,
  BankOutlined: BankOutlined,
  DashboardFilled: DashboardFilled,
  InfoCircleFilled: InfoCircleFilled,
  UserAddOutlined: UserAddOutlined,
  PrinterOutlined: PrinterOutlined,
  ProjectOutlined: ProjectOutlined,
  CarryOutOutlined: CarryOutOutlined,
  BarChartOutlined: BarChartOutlined,
  SwapOutlined: SwapOutlined,
  UserSwitchOutlined: UserSwitchOutlined,
};

const getIconComponent = (iconName) => iconMap[iconName] || null;

// export const transformQueryToOfficeItems = (queryData) => {
//   const groupedByType = queryData.reduce((acc, item) => {
//     const type = item.code_submodule;
//     if (!acc[type]) acc[type] = [];
//     acc[type].push(item);
//     return acc;
//   }, {});

//   return Object.keys(groupedByType).map((type) => ({
//     type,
//     items: groupedByType[type].map((item, index) => ({
//       name: item.name_submodule,
//       id: index,
//       icon: getIconComponent(item.submodule_icon),
//       path: item.submodule_path,
//       children: item.has_children
//         ? item.children.map((child, childIndex) => ({
//             name: child.name,
//             id: childIndex,
//             icon: getIconComponent(child.icon),
//             path: child.path,
//             children:
//               child.children && child.children.length > 0
//                 ? child.children.map((miniChild, miniChildIndex) => ({
//                     name: miniChild.name,
//                     id: miniChildIndex,
//                     icon: miniChild.icon
//                       ? getIconComponent(miniChild.icon)
//                       : null,
//                     path: miniChild.path,
//                   }))
//                 : [], // Dành cho menu con của phần Phân quyền quản trị
//           }))
//         : [],
//       defaultViews: item.default_views
//         ? item.default_views.map((view, viewIndex) => ({
//             key: view.path,
//             label: view.view_name,
//             icon: getIconComponent(view.icon),
//             order: view.order,
//           }))
//         : [],
//     })),
//   }));
// };
export const transformQueryToOfficeItems = (queryData) => {
  const groupedByType = queryData.reduce((acc, item) => {
    const type = item.code_submodule;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  return Object.keys(groupedByType).map((type) => {
    // Bước 1: Map dữ liệu như cũ
    const allItems = groupedByType[type].map((item, index) => {
      const children = item.has_children && item.children
        ? item.children.map((child, childIndex) => ({
            name: child.name,
            id: childIndex,
            icon: getIconComponent(child.icon),
            path: child.path,
            children: child.children?.length > 0
              ? child.children.map((miniChild, miniChildIndex) => ({
                  name: miniChild.name,
                  id: miniChildIndex,
                  icon: miniChild.icon ? getIconComponent(miniChild.icon) : null,
                  path: miniChild.path,
                }))
              : [],
          }))
        : [];

      const defaultViews = item.default_views
        ? item.default_views.map((view) => ({
            key: view.path,
            label: view.view_name,
            icon: getIconComponent(view.icon),
            order: view.order,
          }))
        : [];

      return {
        name: item.name_submodule,
        id: index,
        icon: getIconComponent(item.submodule_icon),
        path: item.submodule_path,
        children,
        defaultViews,
      };
    });

    // Bước 2: Lọc bỏ các item "rỗng" (không có view và không có con)
    const filteredItems = allItems.filter(item => 
      item.children.length > 0 || item.defaultViews.length > 0
    );

    return {
      type,
      items: filteredItems,
    };
  }).filter(group => group.items.length > 0); // (Tùy chọn) Lọc bỏ luôn Group nếu không còn item nào
};