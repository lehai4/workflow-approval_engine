import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  Grid,
  Input,
  Select,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

const FilterGroup = ({
  isMobile,
  search,
  setSearch,
  allProposalType,
  setActiveTabKey,
  onRangeChange,
  rangePresets,
  reloadOnData,
  handleExportExcel,
  type,
  setOpen,
  closeDrawerIfMobile,
  setOpenDrawer,
  state,
}) => (
  <div
    className={`tw-flex ${isMobile ? "tw-flex-col tw-gap-4" : "tw-flex-row tw-flex-wrap tw-items-center tw-gap-2"}`}
  >
    <Input
      placeholder="Tìm tên đề xuất..."
      prefix={<SearchOutlined className="tw-text-gray-400" />}
      allowClear
      value={search.nameProposalReality}
      onChange={(e) => setSearch((prev) => ({ ...prev, nameProposalReality: e.target.value }))}
      onPressEnter={() => closeDrawerIfMobile()}
      className={isMobile ? "tw-w-full" : "tw-w-[180px] focus:tw-w-[250px] tw-transition-all"}
    />

    <Input
      placeholder="Tìm phòng ban đề xuất..."
      prefix={<SearchOutlined className="tw-text-gray-400" />}
      allowClear
      value={search.department}
      onChange={(e) => setSearch((prev) => ({ ...prev, department: e.target.value }))}
      onPressEnter={() => closeDrawerIfMobile()}
      className={isMobile ? "tw-w-full" : "tw-w-[180px] focus:tw-w-[250px] tw-transition-all"}
    />

    <Select
      showSearch
      placeholder="Loại đề xuất"
      optionFilterProp="children"
      filterOption={(input, option) => (option?.children ?? "").toLowerCase().includes(input.toLowerCase())}
      onChange={(e) => {
        setActiveTabKey("all");
        setSearch((prev) => ({ ...prev, nameProposalType: e }));
        closeDrawerIfMobile();
      }}
      value={search.nameProposalType || "all"}
      className={isMobile ? "tw-w-full" : "tw-w-[240px]"}
    >
      <Select.Option value={"all"}>Tất cả loại</Select.Option>
      {allProposalType?.data.map((item) => (
        <Select.Option key={item.uid} value={item.uid}>
          {item.name_proposal_type}
        </Select.Option>
      ))}
    </Select>

    {type !== "approved" && (
      <Select
        onChange={(e) => {
          setActiveTabKey("all");
          setSearch((prev) => ({ ...prev, status: e }));
          closeDrawerIfMobile();
        }}
        value={search.status}
        className={isMobile ? "tw-w-full" : "tw-w-[150px]"}
        allowClear
        placeholder="Trạng thái"
      >
        <Select.Option value={"all"}>Tất cả trạng thái</Select.Option>
        {type !== "approve" && type !== "follow" && type !== "notification" && type !== "execute" && (
          <Select.Option value={"draft"}>Nháp</Select.Option>
        )}
        <Select.Option value={"waiting"}>Đang chờ duyệt</Select.Option>
        <Select.Option value={"rejected"}>Đã từ chối</Select.Option>
        <Select.Option value={"done"}>Đã duyệt</Select.Option>
        {type !== "approve" && type !== "follow" && type !== "notification" && type !== "execute" && (
          <Select.Option value={"cancelled"}>Hủy</Select.Option>
        )}
      </Select>
    )}

    <RangePicker
      presets={rangePresets}
      format="DD/MM/YYYY"
      onChange={onRangeChange}
      value={
        search.timeSelect
          ? [dayjs(search.timeSelect[0], "DD/MM/YYYY"), dayjs(search.timeSelect[1], "DD/MM/YYYY")]
          : null
      }
      className={isMobile ? "tw-w-full" : "tw-w-[240px]"}
    />

    {/* Desktop: nút Tải lại / Xuất Excel nằm ở hàng tiêu đề (ProposalHeader) */}
    {isMobile && (
      <>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            reloadOnData();
            setOpenDrawer(false);
          }}
        >
          Tải lại
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={() => {
            handleExportExcel();
            closeDrawerIfMobile();
          }}
        >
          Xuất dữ liệu
        </Button>
      </>
    )}
  </div>
);

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const ProposalHeader = ({
  reloadOnData,
  allProposalType,
  search,
  setSearch,
  setActiveTabKey,
  onRangeChange,
  rangePresets,
  state,
  setOpen,
  handleExportExcel,
  permission,
  type,
}) => {
  const [openDrawer, setOpenDrawer] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  const filterCount = useMemo(() => {
    let count = 0;
    if (search.nameProposalType && search.nameProposalType !== "all") count++;
    if (search.department && search.department.trim() !== "") count++; // Thêm count cho tìm kiếm phòng ban
    if (search.status && search.status !== "all") count++;
    if (search.nameProposalReality && search.nameProposalReality.trim() !== "") count++; // Thêm count cho tìm kiếm tên
    if (search.startDate || search.endDate) count++;

    return count;
  }, [search]);

  const handleResetFilters = () => {
    setSearch({
      nameProposalReality: "",
      nameProposalType: "all",
      department: "",
      timeSelect: [
        dayjs().subtract(1, "month").format("DD/MM/YYYY"),
        dayjs().format("DD/MM/YYYY"),
      ],
      status: type === "approve" ? "waiting" : null,
      permission,
    });
    if (isMobile) setOpenDrawer(false);
  };

  const closeDrawerIfMobile = () => {
    if (isMobile) setOpenDrawer(false);
  };


  return (
    <div className="tw-flex tw-flex-col tw-shrink-0 tw-bg-white tw-shadow-sm">
      <div
        // Hàng 1: tiêu đề + nút thao tác; hàng 2 (desktop): ô lọc, tự xuống dòng khi màn hẹp
        // (trước đây cùng một hàng nên ở 1366-1536px dãy lọc tràn ra ngoài, che nút Thêm mới)
        className="tw-flex tw-flex-col tw-gap-2 tw-p-2"
        style={{ borderBottom: "1px solid #f0f0f0" }}
      >
       <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
        <span className="tw-font-semibold tw-text-lg tw-whitespace-nowrap tw-mr-2">
          {isMobile ? "Đề xuất" : "Danh sách đề xuất"}
        </span>

        <div className="tw-flex tw-items-center tw-gap-2">
          {!isMobile && (
            <>
              <Tooltip title="Tải lại">
                <Button icon={<ReloadOutlined />} onClick={reloadOnData} />
              </Tooltip>
              <Tooltip title="Xuất Excel">
                <Button icon={<SaveOutlined />} onClick={handleExportExcel} />
              </Tooltip>
            </>
          )}
          {/* Nút Xóa lọc Desktop: Hiện icon cho tinh tế */}
          {!isMobile && filterCount > 0 && (
            <Tooltip title="Xóa tất cả lọc">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={handleResetFilters}
              />
            </Tooltip>
          )}

          {isMobile && (
            <Badge count={filterCount} size="small" offset={[-2, 2]}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setOpenDrawer(true)}
              />
            </Badge>
          )}

          {state?.userFeature?.includes("CREATE") && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
              className="tw-font-medium"
            >
              {!isMobile && !isTablet && "Thêm mới"}
            </Button>
          )}
        </div>
       </div>

        {!isMobile && (
          <FilterGroup
            isMobile={isMobile}
            search={search}
            setSearch={setSearch}
            allProposalType={allProposalType}
            setActiveTabKey={setActiveTabKey}
            onRangeChange={onRangeChange}
            rangePresets={rangePresets}
            reloadOnData={reloadOnData}
            handleExportExcel={handleExportExcel}
            type={type}
            setOpen={setOpen}
            closeDrawerIfMobile={closeDrawerIfMobile}
            setOpenDrawer={setOpenDrawer}
            state={state}
          />
        )}
      </div>

      <Drawer
        title="Bộ lọc dữ liệu"
        placement="right"
        onClose={() => setOpenDrawer(false)}
        open={openDrawer}
        width={300}
        footer={
          <div className="tw-flex tw-gap-2">
            <Button
              danger
              className="tw-flex-1"
              icon={<DeleteOutlined />}
              onClick={handleResetFilters}
            >
              Bỏ bộ lọc
            </Button>
            <Button
              type="primary"
              className="tw-flex-1"
              onClick={() => setOpenDrawer(false)}
            >
              Xong
            </Button>
          </div>
        }
      >
        <FilterGroup
          isMobile={isMobile}
          search={search}
          setSearch={setSearch}
          allProposalType={allProposalType}
          setActiveTabKey={setActiveTabKey}
          onRangeChange={onRangeChange}
          rangePresets={rangePresets}
          reloadOnData={reloadOnData}
          handleExportExcel={handleExportExcel}
          type={type}
          setOpen={setOpen}
          closeDrawerIfMobile={closeDrawerIfMobile}
          setOpenDrawer={setOpenDrawer}
          state={state}
        />
      </Drawer>
    </div>
  );
};

export default ProposalHeader;
