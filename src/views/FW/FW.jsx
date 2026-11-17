import { fwHttp } from "@/api/fwHttp";
import { default as Calender } from "@/components/common/Calender";
import { FormEnvironment } from "@/components/ui";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { formatDateNotSecond } from "@/utils";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DownOutlined,
  LoadingOutlined,
  StarOutlined,
  UpOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  List,
  Row,
  Skeleton,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { Link } from "react-router-dom";

// ---- Ô "Trao đổi gần đây": mỗi dòng là một tin nhắn (avatar chữ cái, tên + giờ, bong bóng nội dung, link đề xuất) ----
const AVATAR_COLORS = ["#1677ff", "#13a8a8", "#722ed1", "#fa8c16", "#eb2f96", "#52c41a", "#2f54eb"];
const initialOf = (name = "") => (String(name).trim().split(/\s+/).pop() || "?").charAt(0).toUpperCase();
const colorOf = (key = "") => AVATAR_COLORS[[...String(key)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
// Làm nổi phần nhắc tên "@PHÒNG X (TÊN)" trong nội dung
const MentionText = ({ text }) =>
  String(text || "")
    .split(/(@[^@()\n]*\([^)]*\))/g)
    .map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} style={{ color: "#1677ff", fontWeight: 500 }}>
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
const shortTime = (d) => {
  const t = dayjs(d);
  if (!t.isValid()) return "";
  if (t.isSame(dayjs(), "day")) return t.format("HH:mm");
  if (t.isSame(dayjs().subtract(1, "day"), "day")) return `Hôm qua ${t.format("HH:mm")}`;
  return t.format(t.isSame(dayjs(), "year") ? "DD/MM HH:mm" : "DD/MM/YYYY");
};
const MessageRow = ({ item, senderName, senderDept, isMe, link }) => (
  <div className="tw-flex tw-gap-3 tw-w-full tw-min-w-0">
    <Avatar
      size={34}
      style={{ background: isMe ? "#1677ff" : colorOf(item.id_people_sender), flex: "none", fontWeight: 600 }}
    >
      {isMe ? "Tôi" : initialOf(senderName)}
    </Avatar>
    <div className="tw-flex tw-flex-col tw-gap-1 tw-min-w-0 tw-flex-1">
      <div className="tw-flex tw-items-baseline tw-gap-2 tw-min-w-0">
        <span className="tw-font-semibold tw-truncate" style={{ fontSize: 14, color: "#1f1f1f" }}>
          {isMe ? "Bạn" : senderName || item.id_people_sender}
        </span>
        <span className="tw-shrink-0" style={{ fontSize: 12, color: "#8c8c8c" }} title={formatDateNotSecond(item.created_at)}>
          {shortTime(item.created_at)}
        </span>
      </div>
      {!isMe && senderDept && (
        <span className="tw-truncate" style={{ fontSize: 12, color: "#8c8c8c", marginTop: -4 }}>
          {senderDept}
        </span>
      )}
      <div
        style={{
          background: "#f5f5f5",
          borderRadius: "4px 12px 12px 12px",
          padding: "6px 10px",
          fontSize: 13,
          lineHeight: 1.5,
          color: "#262626",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <MentionText text={item.message} />
      </div>
      <span className="tw-truncate" style={{ fontSize: 12, color: "#8c8c8c" }}>
        trên {item.reality_type === "Proposal" ? "đề xuất" : "đăng ký"}{" "}
        <Link to={link} target="_blank" className="tw-no-underline hover:tw-underline" style={{ fontWeight: 500 }}>
          {item.name_data}
        </Link>
      </span>
    </div>
  </div>
);

// Đã chờ bao lâu kể từ lúc tới lượt mình duyệt -> nhãn + màu (xám < 3 ngày, cam 3-7 ngày, đỏ > 7 ngày)
const waitingInfo = (since) => {
  const t = dayjs(since);
  if (!since || !t.isValid()) return null;
  const hours = dayjs().diff(t, "hour");
  const days = Math.floor(hours / 24);
  const label = hours < 1 ? "Vừa tới lượt" : days < 1 ? `Chờ ${hours} giờ` : `Chờ ${days} ngày`;
  if (days > 7) return { label, color: "#cf1322", bg: "#fff1f0", border: "#ffccc7" };
  if (days >= 3) return { label, color: "#d46b08", bg: "#fff7e6", border: "#ffd591" };
  return { label, color: "#595959", bg: "#f5f5f5", border: "#e8e8e8" };
};
import { toast } from "react-toastify";

const ApprovalCard = ({
  title,
  data,
  loading,
  loadMore,
  collapsed,
  onToggle,
  getLink,
  getTitle,
  getDescription,
  getSub, // dòng phụ dưới tiêu đề: loại đề xuất / tài nguyên + giờ đặt
  renderContent, // tự vẽ cả dòng (ô Trao đổi gần đây)
  isMessage = false,
}) => {
  return (
    <Card
      title={title}
      extra={
        <Button
          type="text"
          size="small"
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={onToggle}
          style={{ color: "#666", fontWeight: 500 }}
        />
      }
      className="tw-shadow-sm"
      style={{ overflow: "hidden" }}
      styles={{ body: { padding: 0, transition: "all 0.3s ease" } }}
    >
      <div
        style={{
          maxHeight: collapsed ? 0 : 420,
          overflow: "hidden",
          transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            maxHeight: 420,
            overflowY: "auto",
            padding: "16px 16px 8px 16px",
          }}
          className="scroll-container"
        >
          <List
            itemLayout="horizontal"
            dataSource={data}
            loading={loading}
            renderItem={(item) => {
              const wait = isMessage ? null : waitingInfo(item.waiting_since || item.created_at);
              return (
              <List.Item
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f0f0",
                  marginBottom: 0,
                }}
              >
                <Skeleton avatar title={false} loading={item.loading} active>
                  {renderContent ? renderContent(item) : (
                  <>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={36}
                        src={item.avatar} // Nếu có thì hiện ảnh
                        icon={!item.avatar ? <ClockCircleOutlined /> : null} // Không có ảnh thì hiện icon đồng hồ
                        style={{
                          // Cần duyệt: màu theo thời gian đã chờ (xám / cam / đỏ); trao đổi: vàng như cũ
                          backgroundColor: !item.avatar ? wait?.bg || "#fffbe6" : "#e6f7ff",
                          color: !item.avatar ? wait?.color || "#faad14" : "#1890ff",
                          border: !item.avatar ? `1px solid ${wait?.border || "#ffe58f"}` : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      />
                    }
                    title={
                      !isMessage ? (
                        <Link
                          to={getLink(item)}
                          className="tw-font-medium tw-no-underline hover:tw-text-emerald-600"
                          target="_blank"
                          style={{ fontSize: "14px", fontWeight: 600 }}
                        >
                          {getTitle(item)}
                        </Link>
                      ) : (
                        getTitle(item)
                      )
                    }
                    description={
                      !isMessage ? (
                        // Bỏ cột ngày bên phải (làm tên xuống 3 dòng): loại / ngày / thời gian chờ xếp bên dưới tên
                        <div className="tw-flex tw-flex-col tw-gap-1">
                          {getSub?.(item) && (
                            <span style={{ fontSize: 12, color: "#8c8c8c" }}>{getSub(item)}</span>
                          )}
                          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2 tw-gap-y-1" style={{ fontSize: 13, color: "#595959" }}>
                            <span>
                              {getDescription(item)}
                              <span style={{ color: "#bfbfbf" }}> · </span>
                              <span style={{ color: "#8c8c8c", fontSize: 12 }}>{formatDateNotSecond(item.created_at)}</span>
                            </span>
                            {wait && (
                              <span
                                style={{
                                  fontSize: 12,
                                  lineHeight: "18px",
                                  padding: "0 8px",
                                  borderRadius: 10,
                                  color: wait.color,
                                  background: wait.bg,
                                  border: `1px solid ${wait.border}`,
                                }}
                              >
                                {wait.label}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        getDescription(item)
                      )
                    }
                  />
                  {isMessage && (
                    <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
                      {formatDateNotSecond(item.created_at)}
                    </div>
                  )}
                  </>
                  )}
                </Skeleton>
              </List.Item>
              );
            }}
          />

          {loadMore && (
            <div
              style={{
                textAlign: "center",
                padding: "4px 0 12px", // không kẻ thêm: dòng cuối danh sách đã có đường kẻ
                marginTop: 0,
              }}
            >
              {loadMore}
            </div>
          )}
        </div>
      </div>

      {/* <style jsx>{`
        .scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: #d9d9d9;
          border-radius: 3px;
        }
        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: #bfbfbf;
        }
        .scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #d9d9d9 transparent;
        }
      `}</style> */}
    </Card>
  );
};

const FW = () => {
  const { ma_nv } = useSelector(
    (state) => state.authen?.user?.info ?? {},
    shallowEqual,
  );
  const firstRun = useRef(null);
  const [status, setStatus] = useState({
    isLoading: false,
    isSubmitting: false,
    isUpdating: false,
  });

  const [initLoading] = useState(false);
  // Trong file chính của bạn
  const [collapsedProposal, setCollapsedProposal] = useState(false);
  const [collapsedEnvironment, setCollapsedEnvironment] = useState(false);
  const [collapsedMesageBox, setCollapsedMesageBox] = useState(false);

  const [pageProposal, setPageProposal] = useState(1);
  const [pageEnvironment, setPageEnvironment] = useState(1);
  const [pageMessageBox, setPageMessageBox] = useState(1);
  const [limit] = useState(3);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [loadingEnvironment, setLoadingEnvironment] = useState(false);
  const [loadingMessageBox, setLoadingMessageBox] = useState(false);

  const reducer = (state, action) => {
    switch (action.type) {
      case "SET_DATA":
        return {
          ...state,
          ...Object.fromEntries(
            Object.entries(action.payload).filter(
              ([__dirname, value]) => value !== undefined,
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

      case "CLEAR_LOADING":
        return {
          ...state,
          isLoading: false,
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

  const [state, dispatch] = useReducer(reducer, {
    // userFeature: null,
    syncNV: [],
    configApproval: [],
    expansionField: [],
    department: [],
    applicableDecentralization: [],
    proposalReality: {
      currentPage: 1,
      dsList: [],
      totalItems: 0,
      totalPages: 0,
    },
    environmentReality: {
      currentPage: 1,
      dsList: [],
      totalItems: 0,
      totalPages: 0,
    },
    messageBox: {
      currentPage: 1,
      dsList: [],
      totalItems: 0,
      totalPages: 0,
    },
    // infoGroupResourceByCodeGroupResource: null,
    // infoResourceEnvironmentByCodeResourceEnvironment: null,
    groupResources: [],
    resourceEnvironments: [],
    allResourceEnvironmentReality: [],
    isLoading: false,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const searchQuery = {
        ma_nv,
        page: pageProposal,
        limit,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      //
      const searchQueryEr = {
        ma_nv,
        page: pageEnvironment,
        limit,
      };

      const combinedParamsEr = { ...searchQueryEr };

      const filteredEntriesEr = Object.entries(combinedParamsEr).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParamsEr = new URLSearchParams(
        Object.fromEntries(filteredEntriesEr),
      );

      //
      const searchQueryMb = {
        ma_nv,
        page: pageMessageBox,
        limit,
      };

      const combinedParamsMb = { ...searchQueryMb };

      const filteredEntriesMb = Object.entries(combinedParamsMb).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParamsMb = new URLSearchParams(
        Object.fromEntries(filteredEntriesMb),
      );

      const [
        // userFeatureRes,
        syncNVRes,
        departmentRes,
        configApprovalRes,
        expansionFieldRes,
        proposalRealityRes,
        environmentRealityRes,
        messageBoxRes,
        applicableDecentralizationRes,
        groupResourceRes,
        resourceEnvironmentRes,
        // infoGroupResourceByCodeGroupResourceRes,
        // infoResourceEnvironmentByCodeResourceEnvironmentRes,
      ] = await Promise.all([
        // fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllConfigApprovalFlow(),
        fwHttp.getAllExpansionField(),
        fwHttp.getProposalRealityMainPointForApproved(queryParams),
        fwHttp.getEnvironmentRealityMainPointForApproved(queryParamsEr),
        fwHttp.getMessageBoxMainPoint(queryParamsMb),
        fwHttp.getAllApplicableDecentralization(),
        //
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(),
        // Dữ liệu "Lịch tuần" (getAllResourceEnvironmentRealityMainPoint) được tải
        // riêng, chỉ khi người dùng mở tab đó — xem fetchCalendarData bên dưới.
        // fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        // fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
      ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          // userFeature:
          //   userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          configApproval: configApprovalRes?.data ?? [],
          expansionField: expansionFieldRes?.data ?? [],
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
          proposalReality: proposalRealityRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          environmentReality: environmentRealityRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          messageBox: messageBoxRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          // infoGroupResourceByCodeGroupResource:
          //   infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          // infoResourceEnvironmentByCodeResourceEnvironment:
          //   infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra",
      });
    }
  };

  // Dữ liệu lịch (nặng, có thể quét nhiều bản ghi) — chỉ tải khi tab "Lịch tuần"
  // được mở, với loading riêng để không chặn cả dashboard.
  const calendarFetchedRef = useRef(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const fetchCalendarData = async () => {
    try {
      calendarFetchedRef.current = true;
      setLoadingCalendar(true);

      const calendarParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            ma_nv,
            startDate: dayjs().subtract(6, "month").format("YYYY-MM-DD"),
            endDate: dayjs().add(6, "month").format("YYYY-MM-DD"),
          }).filter(([, value]) => value != null && value !== ""),
        ),
      );

      const res = await fwHttp.getAllResourceEnvironmentRealityMainPoint(
        calendarParams,
      );

      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "allResourceEnvironmentReality",
          value: res?.data ?? [],
        },
      });
    } catch (err) {
      console.error("Error fetching calendar data:", err);
      toast.error(err.message || "Không tải được dữ liệu lịch tuần");
    } finally {
      setLoadingCalendar(false);
    }
  };

  const reloadOnData = async () => {
    try {
      dispatch({ type: "SET_UPDATING" });

      const searchQuery = {
        ma_nv,
        page: pageProposal,
        limit,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      //
      const searchQueryEr = {
        ma_nv,
        page: pageEnvironment,
        limit,
      };

      const combinedParamsEr = { ...searchQueryEr };

      const filteredEntriesEr = Object.entries(combinedParamsEr).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParamsEr = new URLSearchParams(
        Object.fromEntries(filteredEntriesEr),
      );

      //
      const searchQueryMb = {
        ma_nv,
        page: pageMessageBox,
        limit,
      };

      const combinedParamsMb = { ...searchQueryMb };

      const filteredEntriesMb = Object.entries(combinedParamsMb).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParamsMb = new URLSearchParams(
        Object.fromEntries(filteredEntriesMb),
      );

      const [
        // userFeatureRes,
        syncNVRes,
        departmentRes,
        configApprovalRes,
        expansionFieldRes,
        proposalRealityRes,
        environmentRealityRes,
        messageBoxRes,
        groupResourceRes,
        resourceEnvironmentRes,
        // infoGroupResourceByCodeGroupResourceRes,
        // infoResourceEnvironmentByCodeResourceEnvironmentRes,
      ] = await Promise.all([
        // fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllConfigApprovalFlow(),
        fwHttp.getAllExpansionField(),
        fwHttp.getProposalRealityMainPointForApproved(queryParams),
        fwHttp.getEnvironmentRealityMainPointForApproved(queryParamsEr),
        fwHttp.getMessageBoxMainPoint(queryParamsMb),
        //
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(),
        // fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        // fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
      ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          // userFeature:
          //   userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          configApproval: configApprovalRes?.data ?? [],
          expansionField: expansionFieldRes?.data ?? [],
          proposalReality: proposalRealityRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          environmentReality: environmentRealityRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          messageBox: messageBoxRes?.data ?? {
            currentPage: 1,
            dsList: [],
            totalItems: 0,
            totalPages: 0,
          },
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          // infoGroupResourceByCodeGroupResource:
          //   infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          // infoResourceEnvironmentByCodeResourceEnvironment:
          //   infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
        },
      });
      // Nếu đang ở (hoặc đã từng mở) tab "Lịch tuần" thì làm mới luôn dữ liệu lịch
      if (calendarFetchedRef.current) {
        fetchCalendarData();
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra",
      });
    }
  };

  //cập nhật api
  const updateState = async (key, actionData = null, apiCall = null) => {
    try {
      dispatch({ type: "SET_UPDATING" });

      let newValue;
      if (apiCall) {
        const response = await apiCall(actionData);
        const apiData = response?.data?.result ?? response?.data ?? {};

        // Nếu key là proposalReality → merge dsList
        if (key === "proposalReality" && state[key]?.dsList) {
          newValue = {
            ...state[key],
            ...apiData,
            dsList: [...state[key].dsList, ...(apiData.dsList || [])],
          };
        } else {
          newValue = Array.isArray(state[key]) ? [] : null;
          newValue = apiData;
        }
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
      return;
    }

    fetchAllData();
  }, []);

  // onLoadMore cho từng loại
  const onLoadMoreProposal = async () => {
    if (
      loadingProposal ||
      state.proposalReality.currentPage >= state.proposalReality.totalPages
    )
      return;

    const skeletonCount = 3;
    const skeletonItems = Array.from({ length: skeletonCount }, (_, i) => ({
      uid: `skeleton-${Date.now()}-${i}`,
      name_proposal_reality: "Đang tải...",
      created_by: "",
      created_at: "",
      loading: true,
    }));

    dispatch({
      type: "UPDATE_STATE",
      payload: {
        key: "proposalReality",
        value: {
          ...state.proposalReality,
          dsList: [...state.proposalReality.dsList, ...skeletonItems],
        },
      },
    });

    setLoadingProposal(true);
    const nextPage = pageProposal + 1;
    setPageProposal(nextPage);

    try {
      const searchQuery = { ma_nv, page: nextPage, limit };
      const filtered = Object.entries(searchQuery).filter(
        ([_, v]) => v != null && v !== "",
      );
      const queryParams = new URLSearchParams(Object.fromEntries(filtered));

      await new Promise((resolve) => setTimeout(() => resolve(), 1500));
      const response =
        await fwHttp.getProposalRealityMainPointForApproved(queryParams);
      const apiData = response?.data?.result ?? response?.data ?? {};

      const realItems = state.proposalReality.dsList.filter(
        (item) => !item.loading,
      );
      const newDsList = [...realItems, ...(apiData.dsList || [])];

      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "proposalReality",
          value: {
            ...state.proposalReality,
            ...apiData,
            dsList: newDsList,
            currentPage: nextPage,
          },
        },
      });
    } catch (err) {
      console.error("Load more failed:", err);
      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "proposalReality",
          value: {
            ...state.proposalReality,
            dsList: state.proposalReality.dsList.filter(
              (item) => !item.loading,
            ),
          },
        },
      });
      dispatch({ type: "SET_ERROR", payload: "Không thể tải thêm" });
    } finally {
      setLoadingProposal(false);
    }
  };

  const onLoadMoreEnvironment = async () => {
    if (
      loadingEnvironment ||
      state.environmentReality.currentPage >=
        state.environmentReality.totalPages
    )
      return;

    const skeletonCount = 3;
    const skeletonItems = Array.from({ length: skeletonCount }, (_, i) => ({
      uid: `skeleton-${Date.now()}-${i}`,
      purpose: "Đang tải...",
      created_by: "",
      created_at: "",
      loading: true,
    }));

    dispatch({
      type: "UPDATE_STATE",
      payload: {
        key: "environmentReality",
        value: {
          ...state.environmentReality,
          dsList: [...state.environmentReality.dsList, ...skeletonItems],
        },
      },
    });

    setLoadingEnvironment(true);
    const nextPage = pageEnvironment + 1;
    setPageEnvironment(nextPage);

    try {
      const searchQuery = { ma_nv, page: nextPage, limit };
      const filtered = Object.entries(searchQuery).filter(
        ([_, v]) => v != null && v !== "",
      );
      const queryParams = new URLSearchParams(Object.fromEntries(filtered));

      await new Promise((resolve) => setTimeout(() => resolve(), 1500));
      const response =
        await fwHttp.getEnvironmentRealityMainPointForApproved(queryParams);
      const apiData = response?.data?.result ?? response?.data ?? {};

      const realItems = state.environmentReality.dsList.filter(
        (item) => !item.loading,
      );
      const newDsList = [...realItems, ...(apiData.dsList || [])];

      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "environmentReality",
          value: {
            ...state.environmentReality,
            ...apiData,
            dsList: newDsList,
            currentPage: nextPage,
          },
        },
      });
    } catch (err) {
      console.error("Load more failed:", err);
      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "environmentReality",
          value: {
            ...state.environmentReality,
            dsList: state.environmentReality.dsList.filter(
              (item) => !item.loading,
            ),
          },
        },
      });
      dispatch({ type: "SET_ERROR", payload: "Không thể tải thêm" });
    } finally {
      setLoadingEnvironment(false);
    }
  };

  const onLoadMoreMessageBox = async () => {
    if (
      loadingMessageBox ||
      state.messageBox.currentPage >= state.messageBox.totalPages
    )
      return;

    const skeletonCount = 3;
    const skeletonItems = Array.from({ length: skeletonCount }, (_, i) => ({
      uid: `skeleton-${Date.now()}-${i}`,
      name_data: "Đang tải...",
      created_by: "",
      created_at: "",
      loading: true,
    }));

    dispatch({
      type: "UPDATE_STATE",
      payload: {
        key: "messageBox",
        value: {
          ...state.messageBox,
          dsList: [...state.messageBox.dsList, ...skeletonItems],
        },
      },
    });

    setLoadingMessageBox(true);
    const nextPage = pageMessageBox + 1;
    setPageMessageBox(nextPage);

    try {
      const searchQuery = { ma_nv, page: nextPage, limit };
      const filtered = Object.entries(searchQuery).filter(
        ([_, v]) => v != null && v !== "",
      );
      const queryParams = new URLSearchParams(Object.fromEntries(filtered));

      await new Promise((resolve) => setTimeout(() => resolve(), 1500));
      const response = await fwHttp.getMessageBoxMainPoint(queryParams);
      const apiData = response?.data?.result ?? response?.data ?? {};

      const realItems = state.messageBox.dsList.filter((item) => !item.loading);
      const newDsList = [...realItems, ...(apiData.dsList || [])];

      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "messageBox",
          value: {
            ...state.messageBox,
            ...apiData,
            dsList: newDsList,
            currentPage: nextPage,
          },
        },
      });
    } catch (err) {
      console.error("Load more failed:", err);
      dispatch({
        type: "UPDATE_STATE",
        payload: {
          key: "messageBox",
          value: {
            ...state.messageBox,
            dsList: state.messageBox.dsList.filter((item) => !item.loading),
          },
        },
      });
      dispatch({ type: "SET_ERROR", payload: "Không thể tải thêm" });
    } finally {
      setLoadingMessageBox(false);
    }
  };

  // Tạo loadMore
  const loadMoreProposal =
    !initLoading &&
    !loadingProposal &&
    state.proposalReality.currentPage < state.proposalReality.totalPages ? (
      <div
        style={{
          textAlign: "center",
          marginTop: 24,
          height: 32,
          lineHeight: "32px",
        }}
      >
        {" "}
        <Button onClick={onLoadMoreProposal} loading={loadingProposal}>
          Tải thêm
        </Button>
      </div>
    ) : null;

  const loadMoreEnvironment =
    !initLoading &&
    !loadingEnvironment &&
    state.environmentReality.currentPage <
      state.environmentReality.totalPages ? (
      <div
        style={{
          textAlign: "center",
          marginTop: 24,
          height: 32,
          lineHeight: "32px",
        }}
      >
        <Button onClick={onLoadMoreEnvironment} loading={loadingEnvironment}>
          Tải thêm
        </Button>
      </div>
    ) : null;

  const loadMoreMessageBox =
    !initLoading &&
    !loadingMessageBox &&
    state.messageBox.currentPage < state.messageBox.totalPages ? (
      <div
        style={{
          textAlign: "center",
          marginTop: 24,
          height: 32,
          lineHeight: "32px",
        }}
      >
        <Button onClick={onLoadMoreMessageBox} loading={loadingEnvironment}>
          Tải thêm
        </Button>
      </div>
    ) : null;

  //Calender
  const [formAddEnvironment] = Form.useForm();
  const [openModal, setOpenModal] = useState(false);
  const [eventsData, setEventsData] = useState([]);
  const [view, setView] = useState("month");
  const [modalWidth, setModalWidth] = useState("60%");
  const [optionsApproval, setOptionsApproval] = useState([]);
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component

  const openInNewTab = (to) => {
    const url = to;
    // const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    const newWindow = window.open(url, "_blank");
    if (newWindow) newWindow.opener = null;
  };

  const handleSelect = (slotInfo) => {
    const { start, end } = slotInfo;
    const now = new Date();
    if (end < now) {
      toast.error("⏰ Thời gian này đã qua, không thể đăng ký!");
      return;
    }

    const formatForForm = (date, time) => {
      const formattedDateTime = `${date.format("DD/MM/YYYY")} ${time}`;
      return new Date(dayjs(formattedDateTime, "DD/MM/YYYY HH:mm").toDate());
    };

    const fillForm = (findItem, timeStart, timeEnd) => {
      const groupPeopleFlow = findItem?.id_group_people_flow || [];

      // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
      const normalizedSelected = groupPeopleFlow
        .flatMap((group) => group.id_array_people)
        .map((item) => {
          return item; // fallback nếu không tìm thấy
        });

      // console.log("normalizedSelected", normalizedSelected);

      // Cập nhật optionsApproval
      if (normalizedSelected.includes("any")) {
        setOptionsApproval(state.syncNV);
      } else {
        const selectedSet = new Set(normalizedSelected);
        const filtered = state.syncNV.filter((emp) =>
          selectedSet.has(emp.ma_nv),
        );
        setOptionsApproval(filtered);
      }

      // === XỬ LÝ GIÁ TRỊ CHO FORM ===
      let idGroupPeopleFlowValue;

      if (normalizedSelected.includes("any")) {
        // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        idGroupPeopleFlowValue = null; // hoặc null
      } else {
        // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        idGroupPeopleFlowValue = normalizedSelected.filter(
          (item) => item !== "any",
        );
      }

      formAddEnvironment.setFieldsValue({
        // uid_group_resource: findItem
        //   ? state.infoGroupResourceByCodeGroupResource.uid
        //   : null,
        uid_group_resource: null,
        uid_resource_environment: findItem?.uid || null,
        time_start: timeStart,
        time_end: timeEnd,
        id_group_people_flow: findItem ? idGroupPeopleFlowValue : null,
        id_group_people_notification:
          findItem?.id_group_people_notification || null,
        id_group_people_manager: findItem?.id_group_people_manager || null,
      });
    };

    // const findItem = state.resourceEnvironments.find(
    //   (item) =>
    //     item.uid === state.infoResourceEnvironmentByCodeResourceEnvironment.uid
    // );

    const today = dayjs();
    const startDay = dayjs(start);
    const endDay = dayjs(end);

    let timeStart, timeEnd;

    if (view === "month") {
      timeStart = today.isSame(startDay, "day")
        ? formatForForm(startDay, `${dayjs().hour()}:${dayjs().minute()}`)
        : formatForForm(startDay, "08:00");
      timeEnd = formatForForm(startDay, "17:00");
      fillForm(state.resourceEnvironments, timeStart, timeEnd);
    } else {
      // 👉 view day/week/work_week -> slot đã có giờ chính xác
      timeStart = startDay.toDate();
      timeEnd = endDay.toDate();
    }

    fillForm(state.resourceEnvironments, timeStart, timeEnd);
    setOpenModal(true);

    // if (state?.userFeature?.includes("BOOKING_CREATE")) {
    //   const findItem = state.resourceEnvironments.find(
    //     (item) =>
    //       item.uid ===
    //       state.infoResourceEnvironmentByCodeResourceEnvironment.uid
    //   );

    //   const today = dayjs();
    //   const startDay = dayjs(start);
    //   const endDay = dayjs(end);

    //   let timeStart, timeEnd;

    //   if (view === "month") {
    //     timeStart = today.isSame(startDay, "day")
    //       ? formatForForm(startDay, `${dayjs().hour()}:${dayjs().minute()}`)
    //       : formatForForm(startDay, "08:00");
    //     timeEnd = formatForForm(startDay, "17:00");
    //     fillForm(findItem, timeStart, timeEnd);
    //   } else {
    //     // 👉 view day/week/work_week -> slot đã có giờ chính xác
    //     timeStart = startDay.toDate();
    //     timeEnd = endDay.toDate();
    //   }

    //   fillForm(findItem, timeStart, timeEnd);
    //   setOpenModal(true);
    // } else {
    //   toast.error(
    //     `🚫 Bạn không có quyền đăng ký.
    //                                                                   Vui lòng liên hệ Quản trị viên mở quyền!`
    //   );
    // }
  };

  const handleSelectEvent = (event) => {
    // console.log(event);

    openInNewTab(
      `/fast-work/office/booking/?view=booking&group=${event.code_group_resource}&resource=${event.code_resource_environment}&uid=${event.uid}`,
    );
  };

  const eventPropGetter = useCallback((event, start, end, isSelected) => {
    let backgroundColor = "";
    switch (event.status) {
      case "pending":
        backgroundColor = "#facc15";
        break;
      case "approved":
        backgroundColor = "rgba(5,150,101,1)";
        break;
      case "rejected":
        backgroundColor = "#bb7f07";
        break;
      case "canceled":
        backgroundColor = "rgba(237,41,41,1)";
        break;
      default:
        backgroundColor = "#3174ad";
    }

    return {
      style: {
        backgroundColor,
      },
    };
  }, []);

  const handleChangeGroupResource = (value) => {
    const allValues = formAddEnvironment.getFieldsValue();

    // Giữ lại 3 field này
    const keepFields = ["uid_group_resource", "time_start", "time_end"];

    const newValues = Object.fromEntries(
      Object.keys(allValues).map((key) => [
        key,
        keepFields.includes(key)
          ? key === "uid_group_resource"
            ? value
            : allValues[key]
          : null,
      ]),
    );

    formAddEnvironment.setFieldsValue(newValues);
  };

  const handleChangeResourceEnvironment = useCallback(
    (value) => {
      const findItem = state.resourceEnvironments.find(
        (item) => item.uid === value,
      );

      if (findItem) {
        // console.log("findItem", findItem);
        const groupPeopleFlow = findItem?.id_group_people_flow || [];
        // // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
        // const normalizedSelected = groupPeopleFlow
        //   .flatMap((group) => group.id_array_people)
        //   .map((item) => {
        //     return item; // fallback nếu không tìm thấy
        //   });

        // // console.log("normalizedSelected", normalizedSelected);

        // // Cập nhật optionsApproval
        // if (normalizedSelected.includes("any")) {
        //   setOptionsApproval(state.syncNV);
        // } else {
        //   const selectedSet = new Set(normalizedSelected);
        //   const filtered = state.syncNV.filter((emp) =>
        //     selectedSet.has(emp.ma_nv),
        //   );
        //   setOptionsApproval(filtered);
        // }

        // // === XỬ LÝ GIÁ TRỊ CHO FORM ===
        // let idGroupPeopleFlowValue;

        // if (normalizedSelected.includes("any")) {
        //   // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        //   idGroupPeopleFlowValue = null; // hoặc null
        // } else {
        //   // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        //   idGroupPeopleFlowValue = normalizedSelected.filter(
        //     (item) => item !== "any",
        //   );
        // }

        // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
        const normalizedSelected = groupPeopleFlow
          .flatMap((group) => group.id_array_people)
          .map((item) => {
            return item; // fallback nếu không tìm thấy
          });
        // console.log("normalizedSelected", normalizedSelected);
        // === ĐẾM SỐ LƯỢNG "any" TRONG QUY TRÌNH  ===
        const anyCount = groupPeopleFlow.reduce((count, group) => {
          const userIds = group.id_array_people || [];
          return count + (userIds.includes("any") ? 1 : 0);
        }, 0);

        // console.log("Số lượng 'any' trong quy trình:", anyCount);
        setMaxAnySelection(anyCount); // ← Đây là giá trị giới hạn tối đa

        // === XỬ LÝ OPTIONS CHO SELECT ===
        let availableEmployees = state.syncNV;

        // Nếu không có "any" → chỉ hiển thị những người đã được cấu hình sẵn trong flow
        if (
          !groupPeopleFlow.some((step) => step.id_array_people?.includes("any"))
        ) {
          const selectedUserIds = groupPeopleFlow
            .flatMap((step) => step.id_array_people || [])
            .filter((id) => id !== "any");

          const selectedSet = new Set(selectedUserIds);
          availableEmployees = state.syncNV.filter((emp) =>
            selectedSet.has(emp.ma_nv),
          );
        }

        setOptionsApproval(availableEmployees);

        // === XỬ LÝ GIÁ TRỊ CHO FORM ===
        let idGroupPeopleFlowValue;

        if (normalizedSelected.includes("any")) {
          // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
          idGroupPeopleFlowValue = null; // hoặc null
        } else {
          // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
          idGroupPeopleFlowValue = normalizedSelected.filter(
            (item) => item !== "any",
          );
        }

        formAddEnvironment.setFieldsValue({
          // id_group_people_flow: normalizedSelected,
          id_group_people_flow: idGroupPeopleFlowValue,
          id_group_people_notification: findItem.id_group_people_notification,
          id_group_people_manager: findItem.id_group_people_manager,
        });
      } else {
        formAddEnvironment.setFieldsValue({
          id_group_people_flow: null,
          id_group_people_notification: null,
          id_group_people_manager: null,
        });
      }
    },
    [formAddEnvironment, state],
  );

  // hàm tạo đăng ký mới tài nguyên
  const onFinish = async (e) => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));

      let data = { ...e, ma_nv };

      const selectedUid = e.uid_group_resource;

      const selectedGroupResource = state.groupResources.find(
        (gr) => gr.uid === selectedUid,
      );
      const selectedResource = state.resourceEnvironments.find(
        (re) => re.uid === e.uid_resource_environment,
      );
      // console.log("selectedResource", selectedResource);
      // console.log("selectedResource", selectedGroupResource);

      const groupPeopleFlow = selectedResource?.id_group_people_flow || [];
      const valuesGroup = e?.id_group_people_flow || [];

      if (data.expansionFieldValues && selectedGroupResource?.field_configs) {
        selectedGroupResource.field_configs.forEach((field) => {
          const key = field.ticker || field.label;
          const value = data.expansionFieldValues[key];

          // Nếu có giá trị và là đối tượng dayjs
          if (value && typeof value === "object" && value.$d) {
            if (field.type === 3) {
              data.expansionFieldValues[key] = value.format("DD/MM/YYYY");
            } else if (field.type === 4) {
              data.expansionFieldValues[key] = value.format("DD/MM/YYYY HH:mm");
            }
          }
        });
      }
      let result = [];
      const hasAny = groupPeopleFlow.some((item) =>
        (item.id_array_people || []).includes("any"),
      );

      if (hasAny && groupPeopleFlow.length === 1) {
        // --- Trường hợp (1): approvalConfig chỉ có "any"
        const anyItem = groupPeopleFlow[0]; // lấy metadata từ item any

        valuesGroup.forEach((personId) => {
          result.push({
            // kế thừa các trường từ anyItem, chỉ override id_array_people
            ...anyItem,
            id_array_people: [personId],
            // đảm bảo các field mặc định nếu anyItem thiếu
            is_asign: anyItem.is_asign ?? false,
            time_approve_flow: anyItem.time_approve_flow ?? null,
          });
        });
      } else if (hasAny) {
        // --- Có any + các nhóm khác
        // Khi gặp item chứa "any" -> expand thành từng person trong valuesGroup (mỗi person 1 item)
        // Các nhóm khác giữ nguyên metadata từ approvalConfig
        const anyItem = groupPeopleFlow.find((it) =>
          (it.id_array_people || []).includes("any"),
        );

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];

          if (idPeopleArray.includes("any")) {
            // expand each personId into its own item, inheriting metadata from the any item
            valuesGroup.forEach((personId) => {
              result.push({
                ...anyItem,
                id_array_people: [personId],
                is_asign: anyItem.is_asign ?? false,
                time_approve_flow: anyItem.time_approve_flow ?? null,
              });
            });
          } else {
            // giữ nguyên nhóm, preserve tất cả metadata từ item
            result.push({
              ...item,
              id_array_people: item.id_array_people || [],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
            });
          }
        });
      } else {
        // --- Trường hợp (2): không có any -> grouping theo cấu trúc approvalConfig
        let valueIndex = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];
          if (!idPeopleArray.length) return;

          const groupSize = idPeopleArray.length;
          const newGroup = valuesGroup.slice(
            valueIndex,
            valueIndex + groupSize,
          );
          valueIndex += groupSize;

          if (!newGroup.length) return;

          // giữ nguyên tất cả metadata từ item, chỉ override id_array_people = newGroup
          result.push({
            ...item,
            id_array_people: newGroup,
            is_asign: item.is_asign ?? false,
            time_approve_flow: item.time_approve_flow ?? null,
          });
        });
      }

      // Gán step_flow và isFinalFlow dựa trên index thực tế của result
      result.forEach((r, idx) => {
        r.step_flow = idx;
        r.isFinalFlow = idx === result.length - 1 ? 1 : 0;
      });

      // console.log("result", result);
      data = {
        ...data,
        id_group_people_flow: result,
      };
      // console.log("Dữ liệu gửi:", data);

      await fwHttp.saveResourceEnvironmentReality(data);
      setOpenModal(false);
      formAddEnvironment.resetFields();
      reloadOnData();
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  useEffect(() => {
    if (!state.allResourceEnvironmentReality) return;

    // console.log(state.allResourceEnvironmentReality);
    const newData = state.allResourceEnvironmentReality.map((item) => {
      let status = "approved";

      if (item?.status === 0) {
        status = "canceled";
      } else if (item?.status === 3) {
        status = "rejected";
      } else if (
        item?.status === 1 &&
        item.is_approval_flow === 1 &&
        item?.isFinalFlow === 1
      ) {
        status = "approved";
      } else if (item?.status === 1 && !item?.is_approval_flow) {
        status = "pending";
      }

      return {
        uid: item.uid,
        ma_nv: item.created_by,
        title: item.purpose,
        start: new Date(item.time_start),
        end: new Date(item.time_end),
        status,
        ten_nv:
          state.syncNV.find((sync) => sync.ma_nv === item.created_by)?.ten_nv ||
          null,
        code_group_resource: item.code_group_resource,
        code_resource_environment: item.code_resource_environment,
      };
    });
    setEventsData(newData);
  }, [state.allResourceEnvironmentReality]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setModalWidth("100%");
      } else {
        setModalWidth("60%");
      }
    };
    handleResize(); // chạy lần đầu
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      {(status.isLoading || status.isSubmitting || status.isUpdating) && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }}
        >
          <div className="spinner-border text-light" role="status">
            <span className="visually-hidden">Đang xử lý...</span>
          </div>
        </div>
      )}
      <div className="body">
        <div className="tw-m-2">
          <Tabs
            defaultActiveKey="1"
            onChange={(key) => {
              if (key === "2" && !calendarFetchedRef.current) {
                fetchCalendarData();
              }
            }}
            items={[
              {
                key: "1",
                label: (
                  <Space>
                    <StarOutlined />
                    Tiêu điểm
                  </Space>
                ),
                children: (
                  <Row gutter={16} className="tw-gap-y-4">
                    <Col xs={24} sm={24} md={12}>
                      <ApprovalCard
                        title="Đề xuất cần duyệt"
                        data={state.proposalReality.dsList}
                        loading={initLoading}
                        loadMore={loadMoreProposal}
                        collapsed={collapsedProposal}
                        onToggle={() =>
                          setCollapsedProposal(!collapsedProposal)
                        }
                        getLink={(item) =>
                          `work/request/?view=list&type=dashboard&uid=${item.uid}`
                        }
                        getTitle={(item) => item.name_proposal_reality}
                        getSub={(item) => item.loai_de_xuat}
                        getDescription={(item) =>
                          state.syncNV.find((s) => s.ma_nv === item.created_by)
                            ?.ten_nv || ""
                        }
                      />
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <ApprovalCard
                        title="Đăng ký tài nguyên cần duyệt"
                        data={state.environmentReality.dsList}
                        loading={initLoading}
                        loadMore={loadMoreEnvironment}
                        collapsed={collapsedEnvironment}
                        onToggle={() =>
                          setCollapsedEnvironment(!collapsedEnvironment)
                        }
                        getLink={(item) =>
                          `office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid}`
                        }
                        getTitle={(item) => item.purpose}
                        getSub={(item) =>
                          [
                            item.name_resource_environment,
                            item.time_start &&
                              `${dayjs(item.time_start).format("HH:mm")}–${dayjs(item.time_end).format("HH:mm DD/MM")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        }
                        getDescription={(item) =>
                          state.syncNV.find((s) => s.ma_nv === item.created_by)
                            ?.ten_nv || ""
                        }
                      />
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <ApprovalCard
                        title="Trao đổi gần đây"
                        data={state.messageBox.dsList}
                        loading={initLoading}
                        loadMore={loadMoreMessageBox}
                        collapsed={collapsedMesageBox}
                        onToggle={() =>
                          setCollapsedMesageBox(!collapsedMesageBox)
                        }
                        getLink={(item) =>
                          `office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid}`
                        }
                        isMessage
                        renderContent={(item) => {
                          const info = state.syncNV.find((sync) => sync.ma_nv === item.id_people_sender);
                          return (
                            <MessageRow
                              item={item}
                              isMe={item.id_people_sender === ma_nv}
                              senderName={info?.ten_nv}
                              senderDept={info?.ten_phong_ban}
                              link={
                                item.reality_type === "Proposal"
                                  ? `work/request/?view=list&type=all&uid=${item.uid_reference}`
                                  : `office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid_reference}`
                              }
                            />
                          );
                        }}
                        getTitle={(item) => {
                          let info = state.syncNV.find(
                            (sync) => sync.ma_nv === item.id_people_sender,
                          );
                          // console.log(info);
                          let detail =
                            item.id_people_sender === ma_nv
                              ? "Tôi"
                              : `${info?.ten_phong_ban} (${info?.ten_nv})`;
                          return (
                            <Typography.Text className="!tw-font-normal">
                              <span className="tw-font-semibold">
                                {detail}{" "}
                              </span>{" "}
                              trao đổi trên{" "}
                              {item.reality_type === "Proposal"
                                ? "đề xuất"
                                : "đăng ký"}{" "}
                              <Link
                                to={
                                  item.reality_type === "Proposal"
                                    ? `work/request/?view=list&type=all&uid=${item.uid_reference}`
                                    : `office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid_reference}`
                                }
                                className="tw-font-medium tw-no-underline hover:tw-text-emerald-600"
                                target="_blank"
                                style={{ fontSize: "14px", fontWeight: 600 }}
                              >
                                {item.name_data}
                              </Link>
                            </Typography.Text>
                          );
                        }}
                        getDescription={(item) => {
                          return <>{item.message}</>;
                        }}
                      />
                    </Col>
                  </Row>
                ),
              },
              {
                key: "2",
                label: (
                  <Space>
                    <CalendarOutlined />
                    Lịch tuần
                  </Space>
                ),
                children: (
                  <div>
                    {loadingCalendar ? (
                      <div
                        style={{
                          minHeight: 300,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Spin indicator={<LoadingOutlined spin />} size="large" />
                      </div>
                    ) : (
                      <Calender
                        eventsData={eventsData}
                        handleSelect={handleSelect}
                        setView={setView}
                        view={view}
                        handleSelectEvent={handleSelectEvent}
                        eventPropGetter={eventPropGetter}
                      />
                    )}
                  </div>
                ),
              },
              // {
              //   key: "3",
              //   label: (
              //     <Space>
              //       <MessageOutlined />
              //       Trao đổi
              //     </Space>
              //   ),
              //   children: <div>Không có trao đổi nào gần đây</div>,
              // },
            ]}
            type="card"
          />
        </div>
      </div>

      {/* Modal đóng: giữ form kết nối với một <Form> rỗng vì trang gọi setFieldsValue trước khi mở
          (tránh cảnh báo "useForm is not connected to any Form element") */}
      {!openModal && <Form form={formAddEnvironment} component={false} />}
      {openModal && (
        <FormEnvironment
          state={state}
          openEnvironment={openModal}
          optionsApproval={optionsApproval}
          setOpenEnvironment={setOpenModal}
          width={modalWidth}
          style={{}}
          onFinish={onFinish}
          ma_nv={ma_nv}
          title="Thêm mới đăng ký"
          formEnvironment={formAddEnvironment}
          handleSendEnvironment={() => formAddEnvironment.submit()}
          handleCloseModalEnvironment={() => {
            setOpenModal(false);
            setOptionsApproval([]);
            formAddEnvironment.resetFields();
          }}
          handleChangeGroupResource={handleChangeGroupResource}
          handleChangeResourceEnvironment={handleChangeResourceEnvironment}
           maxAnySelection={maxAnySelection} // Truyền prop maxAnySelection vào FormEnvironment
        />
      )}
    </div>
  );
};

export default FW;
