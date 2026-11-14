import { fwHttp } from "@/api/fwHttp";
import { useRef } from "react";
import { useEffect } from "react";
import { toast } from "react-toastify";
import useSWR from "swr";

// Define API endpoints and their configurations
// apiConfigs.js
export const createApiConfigs = ({ defaultQuery, searchQuery, params }) => ({
  syncPart: {
    key: `getAllPart`,
    fetcher: fwHttp.getAllPart,
    errorMessage: "Lỗi khi lấy danh sách bộ phận",
  },
  syncDepartment: {
    key: `getAllDepartment`,
    fetcher: fwHttp.getAllDepartment,
    errorMessage: "Lỗi khi lấy danh sách phòng ban",
  },
  syncEmployee: {
    key: `getAllEmployee`,
    fetcher: fwHttp.getAllSyncNhanVien,
    errorMessage: "Lỗi khi lấy danh sách nhân viên",
  },
  proposalType: {
    key: `getAllProposalType?${defaultQuery}`,
    fetcher: () => fwHttp.getAllProposalType(defaultQuery),
    errorMessage: "Lỗi khi lấy proposal type",
  },
  configApproval: {
    key: "getAllConfigApprovalFlow",
    fetcher: fwHttp.getAllConfigApprovalFlow,
    errorMessage: "Lỗi khi lấy config approval",
  },
  expansionField: {
    key: "getAllExpansionField",
    fetcher: fwHttp.getAllExpansionField,
    errorMessage: "Lỗi khi lấy expansion field",
  },
  department: {
    key: "getCustomGroupDepartment",
    fetcher: fwHttp.getCustomGroupDepartment,
    errorMessage: "Lỗi khi lấy department group",
  },
  proposalReality: {
    key: `getAllProposalReality?${searchQuery}`,
    fetcher: () => fwHttp.getAllProposalReality(searchQuery),
    errorMessage: "Lỗi khi lấy proposal reality",
  },
  applicableDecentralization: {
    key: `getAllApplicableDecentralization`,
    fetcher: fwHttp.getAllApplicableDecentralization,
    errorMessage: "Lỗi khi lấy phân quyền sử dụng",
  },
  allowEditAttachedFiles: {
    key: `getAllAllowEditAttachedFiles`,
    fetcher: fwHttp.getAllAllowEditAttachedFiles,
    errorMessage: "Lỗi khi lấy phân quyền chỉnh sửa file đính kèm",
  },
  proposalRealityByMaNV: {
    key: `getProposalRealityByMaNV?ma_nv=${params?.ma_nv}`,
    fetcher: () => fwHttp.getProposalByMaNV(params),
    errorMessage: "Lỗi khi lấy proposal reality",
  },
  proposalRealityForApprovedByMaNV: {
    key: `getProposalRealityForApprovedByMaNV?ma_nv=${params?.ma_nv}`,
    fetcher: () => fwHttp.getProposalRealityForApprovedByMaNV(params),
    errorMessage: "Lỗi khi lấy dữ liệu đề xuất cần duyệt",
  },
  totalChartFlowByMaNV: {
    key: `getTotalChartFlowByMaNV?ma_nv=${params?.ma_nv}`,
    fetcher: () => fwHttp.getTotalChartFlowByMaNV(params),
    errorMessage: "Lỗi khi lấy dữ liệu cho biểu đồ",
  },
  totalChartApprovedFlowByMaNV: {
    key: `getTotalChartApprovedFlowByMaNV?ma_nv=${params?.ma_nv}`,
    fetcher: () => fwHttp.getTotalChartApprovedFlowByMaNV(params),
    errorMessage: "Lỗi khi lấy dữ liệu cho biểu đồ",
  },
});

// Utility to create query parameters from an object
export const createQueryParams = (params) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.append(key, value);
  });
  return query;
};

// Custom hook for fetching specific API data with SWR
const useSWRConfig = ({ searchParams, params, apiKeys = [] }) => {
  // Generate query strings
  const defaultQuery = createQueryParams(
    searchParams?.defaultSearch
  ).toString();
  const searchQuery = createQueryParams(
    searchParams?.addLinkProposal
  ).toString();

  const swrOptions = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  };

  const allConfigs = createApiConfigs({ defaultQuery, searchQuery, params });

  const selectedApis = apiKeys.length
    ? apiKeys.reduce((acc, key) => {
        if (allConfigs[key]) acc[key] = allConfigs[key];
        return acc;
      }, {})
    : allConfigs;

  // Consolidated SWR hooks
  const swrResults = Object.entries(selectedApis).reduce(
    (acc, [name, { key, fetcher, errorMessage }]) => {
      const { data: result, error, mutate } = useSWR(key, fetcher, swrOptions);
      acc[name] = { result, error, mutate };
      acc.errors.push({ error, message: errorMessage });
      return acc;
    },
    { errors: [] }
  );

  // Handle errors with toast
  const previousErrorsRef = useRef({});

  useEffect(() => {
    swrResults.errors.forEach(({ error, message }, index) => {
      const key = Object.keys(swrResults).filter((k) => k !== "errors")[index]; // tên API key

      if (error && previousErrorsRef.current[key] !== error) {
        toast.error(error.message || message);
        previousErrorsRef.current[key] = error;
      }
    });
  }, [swrResults.errors]);

  // Return structured data
  return swrResults;
};

export default useSWRConfig;
