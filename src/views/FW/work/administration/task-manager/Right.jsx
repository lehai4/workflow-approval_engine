import { fwHttp } from "@/api/fwHttp";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { LoadingOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Empty,
  Flex,
  Input,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
} from "antd";
import { Fragment, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { toast } from "react-toastify";

// Utility to add timeout to promises
const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Request timed out"));
    }, ms);
  });
  return Promise.race([promise, timeout]);
};

const Right = () => {
  const { permission } = useSelector((state) => state.fastWorkMenu);
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [infoTreeDataFeature, setInfoTreeDataFeature] = useState([]);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  // Người đang được chỉnh quyền (hiện ở tiêu đề ô Chức năng); điện thoại: chọn xong cuộn tới ô này
  const [selectedName, setSelectedName] = useState("");
  const featureCardRef = useRef(null);
  const [search, setSearch] = useState({
    roleId: "all",
    status: "all",
    ma_nv: null,
    ten_nv: null,
  });

  // Tên + mã nhân viên ở cột đầu (trước đây tên nằm cuối, bị cắt / phải cuộn ngang mới thấy)
  const columns = [
    {
      key: "display_name",
      title: "Nhân viên",
      dataIndex: "display_name",
      render: (text, record) => (
        <div className="tw-flex tw-flex-col tw-leading-tight tw-min-w-0">
          <span className="tw-font-medium tw-break-words">{text}</span>
          <span className="tw-text-xs tw-text-gray-500">{record.ma_nv}</span>
        </div>
      ),
    },
    {
      key: "uid_permission",
      title: "Chức danh",
      dataIndex: "uid_permission",
      width: 130,
      ellipsis: true,
      render: (text) => {
        const info = state.permissions.find((item) => item.uid === text);
        return info ? info.name_permission : "";
      },
    },
    {
      key: "status",
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (text) =>
        text === 1 ? <Tag color="green">Hoạt động</Tag> : <Tag>Đã khóa</Tag>,
    },
  ];

  const initialState = {
    syncNV: [],
    department: [],
    permissions: [],
    rolePeoples: [],
    infoTreeDataFeature: [],
    isLoading: true, // Start with isLoading true to show loading initially
    error: null,
    isUpdating: false,
  };

  const reducer = (state, action) => {
    switch (action.type) {
      case "SET_DATA":
        return {
          ...state,
          ...Object.fromEntries(
            Object.entries(action.payload).filter(
              ([_, value]) => value !== undefined,
            ),
          ),
          isLoading: false,
          error: null,
          isUpdating: false,
        };
      case "SET_LOADING":
        return {
          ...state,
          error: null,
          isLoading: true,
        };
      case "SET_UPDATING":
        return {
          ...state,
          error: null,
          isUpdating: true,
        };
      case "SET_ERROR":
        return {
          ...state,
          error: action.payload,
          isUpdating: false,
          isLoading: false,
        };
      case "CLEAR_ERROR":
        return {
          ...state,
          error: null,
        };
      case "UPDATE_STATE":
        if (!(action.payload.key in state)) {
          console.warn(`Invalid key ${action.payload.key}`);
          return state;
        }
        return {
          ...state,
          [action.payload.key]: action.payload.value,
          isUpdating: false,
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const firstRun = useRef(true);

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const newSearch = {
        userId: ma_nv,
        code: "OFFICE",
      };
      const combinedParams = { ...search, ...newSearch };
      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );
      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, departmentRes, permissionsRes, rolePeoplesRes] =
        await withTimeout(
          Promise.all([
            fwHttp.getAllSyncNhanVien(),
            fwHttp.getCustomGroupDepartment(),
            fwHttp.getAllPermissions(),
            fwHttp.getAllRolePeople(queryParams),
          ]),
          15000, // 10 seconds timeout
        );

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          permissions: permissionsRes?.data ?? [],
          rolePeoples: rolePeoplesRes?.data ?? [],
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Không thể tải dữ liệu, vui lòng thử lại!",
      });
    }
  };

  const reloadOnData = async () => {
    try {
      dispatch({ type: "SET_UPDATING" });

      const newSearch = {
        userId: ma_nv,
        code: "OFFICE",
      };
      const combinedParams = { ...search, ...newSearch };
      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );
      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, departmentRes, permissionsRes, rolePeoplesRes] =
        await withTimeout(
          Promise.all([
            fwHttp.getAllSyncNhanVien(),
            fwHttp.getCustomGroupDepartment(),
            fwHttp.getAllPermissions(),
            fwHttp.getAllRolePeople(queryParams),
          ]),
          15000,
        );

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          permissions: permissionsRes?.data ?? [],
          rolePeoples: rolePeoplesRes?.data ?? [],
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Không thể tải dữ liệu, vui lòng thử lại!",
      });
    }
  };

  const updateState = async (key, actionData = null, apiCall = null) => {
    try {
      dispatch({ type: "SET_UPDATING" });

      let newValue;
      if (apiCall) {
        const response = await withTimeout(apiCall(actionData), 15000);
        newValue =
          response?.data?.response ??
          response?.data ??
          (Array.isArray(state[key]) ? [] : null);
      } else {
        newValue = actionData;
      }
      dispatch({
        type: "UPDATE_STATE",
        payload: { key, value: newValue },
      });
    } catch (err) {
      console.error(`Error updating ${key}:`, err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || `Có lỗi khi cập nhật ${key}`,
      });
    }
  };

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      fetchAllData();
    }
    return () => {
      dispatch({ type: "SET_ERROR", payload: null });
    };
  }, []);

  useEffect(() => {
    const combinedParams = { ...search };
    const filteredEntries = Object.entries(combinedParams).filter(
      ([, value]) => value != null && value !== "",
    );
    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );

    updateState("rolePeoples", null, (data) =>
      fwHttp.getAllRolePeople(queryParams, data),
    );
  }, [search]);

  const convertFeatureTree = (data) => {
    return data.map((sub) => ({
      title: sub.name_submodule,
      key: `${sub.uid_submodule}`,
      children:
        sub.default_views?.map((view) => ({
          title: view.view_name,
          key: `${view.uuid}`,
          children:
            view.features?.map((ft) => ({
              title: ft.name,
              key: ft.uid,
              isLeaf: true,
              uid_submodule: sub.uid_submodule, // Thêm uid_submodule vào node lá
            })) || [],
        })) || [],
    }));
  };

  const handleGetAccessByUserId = async (values) => {
    const newSearch = {
      userId: values.ma_nv,
      code: "WORK",
    };
    const combinedParams = { ...newSearch };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );
    setSelectedUserId(values.ma_nv);
    try {
      const response =
        await fwHttp.getInfoTreePermissionRoleFeature(queryParams);
      const userPermissions = await fwHttp.getUserFeaturePermissions(
        values.ma_nv,
      );

      const sortData =
        response.data.length > 0
          ? response.data.map((item) => ({
              ...item,
              default_views: item.default_views
                .sort((a, b) => a.order - b.order)
                .map((d) => ({
                  ...d,
                  features: d?.features?.sort(
                    (a, b) => a.order_num - b.order_num,
                  ),
                })),
            }))
          : [];
      setInfoTreeDataFeature(sortData || []);
      setCheckedKeys(userPermissions.data.map((p) => p.uid_feature));
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    }
  };

  const getAllKeys = (nodes) => {
    let keys = [];
    nodes.forEach((n) => {
      keys.push(n.key);
      if (n.children) keys = keys.concat(getAllKeys(n.children));
    });
    return keys;
  };

  const isRowClickable = (record) => {
    if (record.status === 0) return false; // Disabled rows are never clickable
    if (permission === "Quản trị viên") return true; // Admins can click any row
    if (permission === "Quản lý") {
      // Managers cannot click admin rows
      return record.name_permission !== "Quản trị viên"; // Assuming role field identifies admins
    }
    return false; // Default: non-admins/managers can't click
  };

  const getAllFeatureUids = (treeData) => {
    const uids = [];
    treeData.forEach((sub) => {
      sub.default_views.forEach((view) => {
        view.features?.forEach((f) => {
          uids.push(f.uid);
        });
      });
    });
    return uids;
  };

  const [featureSubmoduleMap, setFeatureSubmoduleMap] = useState({});

  // const handleCheck = (checked) => {
  //   const allKeys = getAllKeys(convertFeatureTree(infoTreeDataFeature));
  //   const validChecked = checked.filter((key) => allKeys.includes(key));

  //   // Xây dựng bản đồ uid_feature -> uid_submodule
  //   const newMap = {};
  //   infoTreeDataFeature.forEach((sub) => {
  //     sub.default_views?.forEach((view) => {
  //       view.features?.forEach((ft) => {
  //         if (validChecked.includes(ft.uid)) {
  //           newMap[ft.uid] = sub.uid_submodule;
  //         }
  //       });
  //     });
  //   });
  //   setFeatureSubmoduleMap(newMap);
  //   setCheckedKeys(validChecked);
  // };

  const handleCheck = (checked, currentSubmoduleTreeData) => {
    // 1. Lấy tất cả các keys khả dụng của submodule ĐANG thao tác
    const currentSubmoduleAllKeys = getAllKeys(currentSubmoduleTreeData);

    // 2. Lọc ra những key đang được lưu trong state mà KHÔNG thuộc submodule này
    // (Đây là những key của các module khác, chúng ta cần giữ lại)
    const keysFromOtherSubmodules = checkedKeys.filter(
      (key) => !currentSubmoduleAllKeys.includes(key),
    );

    // 3. Hợp nhất: Key của các module khác + Key vừa mới chọn ở module hiện tại
    const newCheckedKeys = [...keysFromOtherSubmodules, ...checked];

    // 4. Cập nhật state
    setCheckedKeys(newCheckedKeys);

    // 5. Cập nhật featureSubmoduleMap (Giữ lại cái cũ và ghi đè cái mới)
    const newMap = { ...featureSubmoduleMap };

    // Lưu ý: infoTreeDataFeature là toàn bộ cây, bạn có thể lọc map tại đây
    infoTreeDataFeature.forEach((sub) => {
      sub.default_views?.forEach((view) => {
        view.features?.forEach((ft) => {
          if (newCheckedKeys.includes(ft.uid)) {
            newMap[ft.uid] = sub.uid_submodule;
          } else {
            delete newMap[ft.uid]; // Xóa nếu không còn được check
          }
        });
      });
    });
    setFeatureSubmoduleMap(newMap);
  };

  // const handleSaveUserRoleFeature = async () => {
  //   // Lấy tất cả uid_feature hợp lệ trong cây hiện tại
  //   const allFeatureUids = getAllFeatureUids(infoTreeDataFeature);
  //   const validChecked = checkedKeys.filter((key) =>
  //     allFeatureUids.includes(key),
  //   );

  //   let data;

  //   if (validChecked.length === 0) {
  //     // Trường hợp bỏ chọn hết → vẫn cần biết đang thao tác trên những submodule nào
  //     // → lấy tất cả uid_submodule đang hiển thị
  //     const allSubmoduleIds = infoTreeDataFeature.map(
  //       (sub) => sub.uid_submodule,
  //     );
  //     data = {
  //       ma_nv: selectedUserId,
  //       checkedKeys: [],
  //       uid_submodules: allSubmoduleIds, // mảng các submodule đang thao tác
  //       ma_nv_action: ma_nv,
  //     };
  //     // ... gửi lên
  //   } else {
  //     // Trường hợp có check → map từng uid_feature với uid_submodule tương ứng
  //     const uidSubmodulesForChecked = [];

  //     // Duyệt qua cây để tìm uid_submodule cho từng uid_feature được check
  //     infoTreeDataFeature.forEach((sub) => {
  //       const submoduleId = sub.uid_submodule;

  //       sub.default_views?.forEach((view) => {
  //         view.features?.forEach((ft) => {
  //           if (validChecked.includes(ft.uid)) {
  //             uidSubmodulesForChecked.push(submoduleId);
  //           }
  //         });
  //       });
  //     });

  //     data = {
  //       ma_nv: selectedUserId,
  //       checkedKeys: validChecked,
  //       uid_submodules: uidSubmodulesForChecked, // mảng song song với checkedKeys
  //       ma_nv_action: ma_nv,
  //     };
  //     // ... gửi lên
  //   }
  //   console.log(data);
  //   try {
  //     const response = await fwHttp.handleSaveUserRoleFeature(data);
  //     toast.success(response.data.message);
  //   } catch (err) {
  //     toast.error(err.message || "Lỗi khi lưu!");
  //   }
  // };

  const handleSaveUserRoleFeature = async () => {
    // // 1. Kiểm tra nếu chưa chọn nhân viên
    // if (!selectedUserId) {
    //   toast.error("Vui lòng chọn nhân viên trước khi lưu!");
    //   return;
    // }

    // // 2. Lấy tất cả feature UIDs hợp lệ từ cây đang hiển thị (để tránh lưu thừa dữ liệu rác)
    // const allFeatureUids = getAllFeatureUids(infoTreeDataFeature);

    // // 3. Lọc danh sách checkedKeys hiện tại: chỉ lấy những key thuộc về các module đang hiển thị
    // const validChecked = checkedKeys.filter((key) =>
    //   allFeatureUids.includes(key),
    // );

    // let dataToSend;

    // if (validChecked.length === 0) {
    //   // Trường hợp bỏ chọn sạch: Gửi danh sách tất cả submodule đang hiển thị để xóa trắng quyền của chúng
    //   const allSubmoduleIds = infoTreeDataFeature.map(
    //     (sub) => sub.uid_submodule,
    //   );
    //   dataToSend = {
    //     ma_nv: selectedUserId,
    //     checkedKeys: [],
    //     uid_submodules: allSubmoduleIds,
    //     ma_nv_action: ma_nv,
    //   };
    // } else {
    //   const uidSubmodulesForChecked = [];

    //   // Duyệt qua cây để tìm uid_submodule cho từng uid_feature được check
    //   infoTreeDataFeature.forEach((sub) => {
    //     const submoduleId = sub.uid_submodule;

    //     sub.default_views?.forEach((view) => {
    //       view.features?.forEach((ft) => {
    //         if (validChecked.includes(ft.uid)) {
    //           uidSubmodulesForChecked.push(submoduleId);
    //         }
    //       });
    //     });
    //   });
    //   dataToSend = {
    //     ma_nv: selectedUserId,
    //     checkedKeys: validChecked,
    //     uid_submodules: uidSubmodulesForChecked,
    //     ma_nv_action: ma_nv,
    //   };
    // }

    // console.log("Dữ liệu gửi đi:", dataToSend);

    if (!selectedUserId) {
      toast.error("Vui lòng chọn nhân viên trước khi lưu!");
      return;
    }

    // Lấy tất cả feature UIDs của CÁC submodule đang hiển thị trong UI hiện tại
    const allFeatureUidsInUI = getAllFeatureUids(infoTreeDataFeature);

    // Lấy danh sách UID của các Submodule đang hiển thị trong UI (Scope)
    const currentSubmoduleUids = infoTreeDataFeature.map(
      (sub) => sub.uid_submodule,
    );

    // Lọc checkedKeys: Chỉ lấy những key thuộc scope đang hiển thị
    const validChecked = checkedKeys.filter((key) =>
      allFeatureUidsInUI.includes(key),
    );

    const uidSubmodulesForChecked = [];

    // Map feature -> submodule
    infoTreeDataFeature.forEach((sub) => {
      const submoduleId = sub.uid_submodule;
      sub.default_views?.forEach((view) => {
        view.features?.forEach((ft) => {
          if (validChecked.includes(ft.uid)) {
            uidSubmodulesForChecked.push(submoduleId);
          }
        });
      });
    });

    const dataToSend = {
      ma_nv: selectedUserId,
      checkedKeys: validChecked,
      uid_submodules: uidSubmodulesForChecked, // Mảng này giờ sẽ chứa ID của nhiều submodule khác nhau
      target_submodule_uids: currentSubmoduleUids, // Gửi thêm cái này để BE biết phạm vi cần xóa
      ma_nv_action: ma_nv,
    };
    // console.log("Dữ liệu gửi đi:", dataToSend);
    try {
      const response = await fwHttp.handleSaveUserRoleFeature(dataToSend);
      if (response.data) {
        toast.success(response.data.message || "Lưu thành công!");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Lỗi khi lưu!");
    }
  };

  if (state.isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin indicator={<LoadingOutlined spin />} size="large" />
      </div>
    );
  }

  if (state.error) {
    return <ErrorComponent error={state.error} fetchData={fetchAllData} />;
  }

  return (
    <div className="wrapper-content">
      <div
        className="tw-flex tw-flex-col md:tw-flex-row lg:tw-flex-row tw-items-start lg:tw-items-center tw-justify-between tw-gap-2 tw-bg-white tw-p-2 tw-shadow-sm"
        style={{
          borderBottom: "0.1px solid #8080803b",
          position: "relative",
        }}
      >
        <h4>Người dùng</h4>
        <Divider className="tw-my-2 tw-block sm:tw-h md:tw-hidden lg:tw-hidden" />
      </div>
      <div className="body">
        <div
          className="tw-py-3 tw-px-4"
          style={{
            borderBottom: "0.1px solid #8080803b",
            position: "relative",
          }}
        >
          <div className="tw-grid tw-grid-cols-12 tw-gap-4">
            <div className="tw-col-span-12">
              <Row gutter={16} className="tw-gap-y-4">
                <Col xs={24} sm={24} md={14}>
                  <Card title="Danh sách người dùng">
                    <Flex
                      justify="space-between"
                      align="center"
                      className="tw-flex-col tw-gap-4 md:tw-flex-row md:tw-gap-2"
                    >
                      <Flex
                        align="center"
                        gap={4}
                        className="tw-w-full md:tw-w-auto tw-flex-col md:tw-flex-row"
                      >
                        <Input
                          placeholder="Nhập mã nhân viên"
                          onChange={(e) =>
                            setSearch((prev) => ({
                              ...prev,
                              ma_nv: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="Nhập tên nhân viên"
                          onChange={(e) =>
                            setSearch((prev) => ({
                              ...prev,
                              ten_nv: e.target.value,
                            }))
                          }
                        />
                      </Flex>
                      <Button onClick={reloadOnData} className="tw-my-2">
                        Tải lại
                      </Button>
                    </Flex>
                    <Table
                      columns={columns}
                      dataSource={state.rolePeoples
                        .filter((f) => f.status === 1)
                        .map((item) => ({
                          ...item,
                          key: item.uid,
                        }))}
                      locale={{
                        emptyText: "Không có dữ liệu.",
                      }}
                      size="middle"
                      tableLayout="fixed"
                      onRow={(record) => ({
                        onClick: () => {
                          if (isRowClickable(record)) {
                            setSelectedRowKey(record.key);
                            setSelectedName(record.display_name || record.ma_nv);
                            handleGetAccessByUserId(record);
                            if (window.innerWidth < 768) {
                              setTimeout(
                                () => featureCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                                300,
                              );
                            }
                          }
                        },
                        className: isRowClickable(record)
                          ? record.key === selectedRowKey
                            ? "highlighted-row"
                            : ""
                          : "disabled-row",
                      })}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={24} md={10}>
                  <div ref={featureCardRef} />
                  <Card title={selectedName ? `Chức năng · ${selectedName}` : "Chức năng"}>
                    {infoTreeDataFeature.length > 0 ? (
                      <Fragment>
                        <Space direction="vertical" className="tw-w-full">
                          <Collapse
                            items={infoTreeDataFeature.map((sub, i) => {
                              const treeData = convertFeatureTree([sub]);
                              const allKeys = getAllKeys(treeData);

                              return {
                                key: i,
                                label: sub.name_submodule,
                                children: (
                                  // <Tree
                                  //   checkable
                                  //   defaultExpandAll
                                  //   treeData={treeData}
                                  //   checkedKeys={checkedKeys.filter((k) =>
                                  //     allKeys.includes(k),
                                  //   )}
                                  //   onCheck={(checked) => handleCheck(checked)}
                                  //   accordion
                                  //   height={500}
                                  //   showLine
                                  // />
                                  // Tìm đến đoạn render Tree trong Collapse
                                  <Tree
                                    checkable
                                    defaultExpandAll
                                    treeData={treeData} // treeData này là của riêng submodule hiện tại
                                    checkedKeys={checkedKeys.filter((k) =>
                                      allKeys.includes(k),
                                    )}
                                    onCheck={(checked) =>
                                      handleCheck(checked, treeData)
                                    } // Truyền thêm treeData ở đây
                                    accordion
                                    height={500}
                                    showLine
                                  />
                                ),
                              };
                            })}
                          />
                          <Button
                            icon={<SaveOutlined />}
                            type="primary"
                            onClick={handleSaveUserRoleFeature}
                          >
                            Lưu
                          </Button>
                        </Space>
                      </Fragment>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          selectedRowKey
                            ? "Người dùng này chưa có chức năng nào"
                            : "Chọn một người dùng trong danh sách để xem và chỉnh quyền"
                        }
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Right;
