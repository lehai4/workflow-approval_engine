"use client";
// Trình thiết kế luồng duyệt kéo-thả.
// Dữ liệu vào/ra giữ đúng định dạng cũ của "array_approval_flow" (luồng tuần tự):
//   { key, id_array_people: string[], display_name, time_approve_flow (giờ), is_flow (true = bước duyệt,
//     false = người liên quan - chỉ hiển thị, không duyệt), index (thứ tự hiển thị, 1..n) }
// Server đánh step_flow theo thứ tự các bước is_flow = true trong mảng -> không cần sửa engine.
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ApartmentOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  FlagOutlined,
  HolderOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { Alert, Avatar, Button, Empty, Input, InputNumber, Modal, Segmented, Select, Space, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const ANY = "any";
const PALETTE = {
  approve: { label: "Bước duyệt", hint: "Người được chọn phải duyệt mới sang bước sau", icon: <SafetyCertificateOutlined />, color: "#1677ff" },
  watch: { label: "Người liên quan", hint: "Hiển thị trên luồng/báo cáo, không duyệt", icon: <EyeOutlined />, color: "#8c8c8c" },
};
const AVATAR_COLORS = ["#1677ff", "#13c2c2", "#722ed1", "#fa8c16", "#eb2f96", "#52c41a", "#2f54eb"];
const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const colorOf = (id = "") => AVATAR_COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const newStep = (kind = "approve") => ({
  key: uuidv4(),
  id_array_people: [],
  display_name: "",
  time_approve_flow: null,
  is_flow: kind === "approve",
  index: 0,
});

// Dữ liệu cũ: server coi is_flow khác false (kể cả không có) là bước duyệt
export const normalizeSteps = (steps = []) =>
  steps.map((s) => ({ ...s, key: s.key || uuidv4(), id_array_people: s.id_array_people || [], is_flow: s.is_flow !== false }));

// Đánh lại thứ tự hiển thị theo vị trí
const renumber = (steps) => steps.map((s, i) => ({ ...s, index: i + 1 }));

// Kiểm tra luồng, trả về danh sách lỗi theo bước (và lỗi chung)
export const validateFlow = (steps) => {
  const errors = [];
  if (!steps.some((s) => s.is_flow)) errors.push({ message: "Luồng cần ít nhất một bước duyệt." });
  steps.forEach((s, i) => {
    const people = s.id_array_people || [];
    const label = s.display_name || `Bước ${i + 1}`;
    if (!people.length) errors.push({ key: s.key, message: `${label}: chưa chọn người.` });
    if (people.includes(ANY) && people.some((p) => p !== ANY))
      errors.push({ key: s.key, message: `${label}: không chọn "Nhân viên bất kỳ" cùng người cụ thể.` });
    if (people.includes(ANY) && !s.is_flow)
      errors.push({ key: s.key, message: `${label}: "Nhân viên bất kỳ" chỉ dùng cho bước duyệt.` });
  });
  return errors;
};

const PeopleAvatars = ({ ids = [], peopleMap, max = 4, size = 28 }) => {
  if (!ids.length) return <span className="tw-text-xs tw-text-orange-500">Chưa chọn người</span>;
  if (ids.includes(ANY))
    return (
      <Tag icon={<UserOutlined />} color="purple" style={{ marginInlineEnd: 0 }}>
        Người đề xuất tự chọn
      </Tag>
    );
  return (
    <Avatar.Group max={{ count: max, style: { background: "#bfbfbf" } }} size={size}>
      {ids.map((id) => {
        const p = peopleMap.get(id);
        return (
          <Tooltip key={id} title={p ? `${p.ten_nv} (${id})` : id}>
            <Avatar style={{ background: colorOf(id) }}>{initials(p?.ten_nv || id)}</Avatar>
          </Tooltip>
        );
      })}
    </Avatar.Group>
  );
};

// ---------------------------------------------------------------------------
// Thẻ bước trên canvas (kéo để đổi thứ tự)
// ---------------------------------------------------------------------------
function StepCard({ step, order, selected, hasError, peopleMap, onSelect, overlay = false }) {
  const sortable = useSortable({ id: step.key, disabled: overlay });
  const style = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.35 : 1,
      };
  const kind = step.is_flow ? PALETTE.approve : PALETTE.watch;
  return (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      onClick={() => onSelect?.(step.key)}
      className={`tw-relative tw-w-[196px] tw-shrink-0 tw-rounded-xl tw-bg-white tw-cursor-pointer tw-transition-shadow ${
        overlay ? "tw-shadow-2xl" : "hover:tw-shadow-md"
      }`}
    >
      <div
        className="tw-rounded-xl tw-p-3"
        style={{
          border: `2px ${step.is_flow ? "solid" : "dashed"} ${selected ? "#1677ff" : hasError ? "#faad14" : "#e5e7eb"}`,
          boxShadow: selected ? "0 0 0 4px rgba(22,119,255,.12)" : undefined,
        }}
      >
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
          <span
            className="tw-flex tw-items-center tw-justify-center tw-rounded-full tw-text-white tw-text-xs tw-font-semibold"
            style={{ width: 22, height: 22, background: kind.color, flexShrink: 0 }}
          >
            {step.is_flow ? order : <EyeOutlined style={{ fontSize: 11 }} />}
          </span>
          <span className="tw-font-semibold tw-text-sm tw-truncate tw-flex-1" title={step.display_name}>
            {step.display_name || (step.is_flow ? `Bước duyệt ${order}` : "Người liên quan")}
          </span>
          {hasError && <WarningFilled style={{ color: "#faad14" }} />}
          <span
            {...(overlay ? {} : sortable.attributes)}
            {...(overlay ? {} : sortable.listeners)}
            onClick={(e) => e.stopPropagation()}
            className="tw-cursor-grab tw-text-gray-400 hover:tw-text-gray-600 tw-px-1"
            title="Kéo để đổi thứ tự"
          >
            <HolderOutlined />
          </span>
        </div>
        <div className="tw-min-h-[28px] tw-flex tw-items-center">
          <PeopleAvatars ids={step.id_array_people} peopleMap={peopleMap} />
        </div>
        <div className="tw-flex tw-items-center tw-justify-between tw-mt-2 tw-text-xs tw-text-gray-500">
          <span>{step.is_flow ? (step.id_array_people?.length > 1 ? "Một trong số người này duyệt" : "Duyệt") : "Không duyệt"}</span>
          {step.time_approve_flow ? (
            <span>
              <ClockCircleOutlined /> {step.time_approve_flow}h
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const Arrow = () => (
  <div className="tw-flex tw-items-center tw-shrink-0" style={{ width: 36 }}>
    <div className="tw-h-[2px] tw-flex-1 tw-bg-gray-300" />
    <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "7px solid #d1d5db" }} />
  </div>
);

const Terminal = ({ icon, label, sub, color }) => (
  <div className="tw-flex tw-flex-col tw-items-center tw-shrink-0 tw-w-[96px] tw-text-center">
    <div className="tw-flex tw-items-center tw-justify-center tw-rounded-full tw-text-white tw-text-lg tw-shadow" style={{ width: 44, height: 44, background: color }}>
      {icon}
    </div>
    <div className="tw-text-xs tw-font-semibold tw-mt-1">{label}</div>
    {sub ? <div className="tw-text-[11px] tw-text-gray-400">{sub}</div> : null}
  </div>
);

// Mục kéo từ bảng công cụ
function PaletteItem({ kind, onAdd }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${kind}` });
  const p = PALETTE[kind];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="tw-flex tw-items-start tw-gap-2 tw-p-2 tw-rounded-lg tw-bg-white tw-border tw-border-solid tw-border-gray-200 hover:tw-border-blue-400 tw-cursor-grab tw-select-none"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span style={{ color: p.color, fontSize: 18, lineHeight: 1 }}>{p.icon}</span>
      <div className="tw-flex-1 tw-min-w-0">
        <div className="tw-text-sm tw-font-medium">{p.label}</div>
        <div className="tw-text-[11px] tw-text-gray-500 tw-leading-snug">{p.hint}</div>
      </div>
      <Tooltip title="Thêm vào cuối luồng">
        <Button size="small" type="text" icon={<PlusOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAdd(kind)} />
      </Tooltip>
    </div>
  );
}

function CanvasDropZone({ children, empty }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className="tw-rounded-xl tw-overflow-x-auto"
      style={{
        minHeight: 210,
        background: isOver ? "#e6f4ff" : "radial-gradient(#e5e7eb 1px, transparent 1px) 0 0 / 16px 16px, #fafafa",
        border: `1px ${isOver ? "dashed #1677ff" : "solid #f0f0f0"}`,
      }}
    >
      <div className="tw-flex tw-items-center tw-gap-0 tw-p-6 tw-min-w-max">{children}</div>
      {empty}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bảng thuộc tính của bước đang chọn
// ---------------------------------------------------------------------------
function StepInspector({ step, order, people, onChange, onDelete, onDuplicate }) {
  if (!step) {
    return (
      <div className="tw-h-full tw-flex tw-items-center tw-justify-center tw-text-center tw-text-gray-400 tw-text-sm tw-p-4">
        Chọn một bước trên luồng để chỉnh sửa
      </div>
    );
  }
  const set = (patch) => onChange({ ...step, ...patch });
  const options = [
    { value: ANY, label: "Nhân viên bất kỳ (người đề xuất tự chọn)" },
    ...people.map((p) => ({ value: p.ma_nv, label: `${p.ten_nv} (${p.ma_nv})${p.ten_phong_ban ? ` · ${p.ten_phong_ban}` : ""}` })),
  ];
  return (
    <div className="tw-flex tw-flex-col tw-gap-3">
      <div className="tw-flex tw-items-center tw-justify-between">
        <Typography.Text strong>{step.is_flow ? `Bước duyệt ${order}` : "Người liên quan"}</Typography.Text>
        <Space size={4}>
          <Tooltip title="Nhân bản">
            <Button size="small" icon={<CopyOutlined />} onClick={onDuplicate} />
          </Tooltip>
          <Tooltip title="Xoá bước">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
          </Tooltip>
        </Space>
      </div>
      <div>
        <div className="tw-text-xs tw-text-gray-500 tw-mb-1">Loại bước</div>
        <Segmented
          block
          value={step.is_flow ? "approve" : "watch"}
          onChange={(v) => set({ is_flow: v === "approve" })}
          options={[
            { value: "approve", label: "Duyệt", icon: <SafetyCertificateOutlined /> },
            { value: "watch", label: "Chỉ liên quan", icon: <EyeOutlined /> },
          ]}
        />
      </div>
      <div>
        <div className="tw-text-xs tw-text-gray-500 tw-mb-1">Tên bước (hiển thị trên luồng & báo cáo)</div>
        <Input
          value={step.display_name}
          maxLength={100}
          placeholder={step.is_flow ? "VD: Trưởng phòng duyệt" : "VD: Kế toán theo dõi"}
          onChange={(e) => set({ display_name: e.target.value })}
        />
      </div>
      <div>
        <div className="tw-text-xs tw-text-gray-500 tw-mb-1">{step.is_flow ? "Người duyệt (một người duyệt là đủ)" : "Người liên quan"}</div>
        <Select
          mode="multiple"
          className="tw-w-full"
          value={step.id_array_people}
          options={options}
          showSearch
          optionFilterProp="label"
          placeholder="Chọn người"
          maxTagCount="responsive"
          onChange={(v) => {
            // Chọn "bất kỳ" thì bỏ người cụ thể và ngược lại
            const picked = v.at(-1);
            set({ id_array_people: picked === ANY ? [ANY] : v.filter((x) => x !== ANY) });
          }}
        />
      </div>
      {step.is_flow && (
        <div>
          <div className="tw-text-xs tw-text-gray-500 tw-mb-1">Thời hạn xử lý</div>
          <InputNumber
            className="tw-w-full"
            min={0}
            value={step.time_approve_flow}
            suffix="giờ"
            placeholder="Không giới hạn"
            onChange={(v) => set({ time_approve_flow: v ?? null })}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cửa sổ thiết kế
// ---------------------------------------------------------------------------
export default function ApprovalFlowDesignerModal({ open, value, people = [], onCancel, onApply, title = "Thiết kế luồng duyệt" }) {
  const [steps, setSteps] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const peopleMap = useMemo(() => new Map(people.map((p) => [p.ma_nv, p])), [people]);

  useEffect(() => {
    if (open) {
      const init = renumber(normalizeSteps(value || []));
      setSteps(init);
      setSelectedKey(init[0]?.key || null);
      setShowErrors(false);
    }
  }, [open, value]);

  const errors = validateFlow(steps);
  const errorKeys = new Set(errors.filter((e) => e.key).map((e) => e.key));
  const approvalSteps = steps.filter((s) => s.is_flow);
  const totalHours = approvalSteps.reduce((n, s) => n + (Number(s.time_approve_flow) || 0), 0);
  const orderOf = (key) => approvalSteps.findIndex((s) => s.key === key) + 1;
  const selected = steps.find((s) => s.key === selectedKey);

  const add = (kind, at = steps.length) => {
    const s = newStep(kind);
    setSteps((prev) => renumber([...prev.slice(0, at), s, ...prev.slice(at)]));
    setSelectedKey(s.key);
  };

  const onDragStart = ({ active }) => setActiveDrag(active.id);
  const onDragEnd = ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;
    const id = String(active.id);
    if (id.startsWith("palette:")) {
      const kind = id.split(":")[1];
      const overIdx = steps.findIndex((s) => s.key === over.id);
      add(kind, overIdx >= 0 ? overIdx + 1 : steps.length);
      return;
    }
    if (active.id !== over.id && over.id !== "canvas") {
      const from = steps.findIndex((s) => s.key === active.id);
      const to = steps.findIndex((s) => s.key === over.id);
      if (from >= 0 && to >= 0) setSteps((prev) => renumber(arrayMove(prev, from, to)));
    }
  };

  const apply = () => {
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    onApply(renumber(steps));
  };

  const dragStep = steps.find((s) => s.key === activeDrag);
  const dragPalette = String(activeDrag || "").startsWith("palette:") ? PALETTE[String(activeDrag).split(":")[1]] : null;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <Space>
          <ApartmentOutlined />
          {title}
        </Space>
      }
      width={1320}
      // Mở từ trong Drawer sửa/tạo loại đề xuất -> phải nằm trên Drawer
      zIndex={1200}
      // Không đóng bằng Esc / click ra ngoài: người dùng hay nhấn Esc để đóng ô chọn người,
      // đóng nhầm sẽ mất các chỉnh sửa đang dở
      keyboard={false}
      maskClosable={false}
      style={{ maxWidth: "calc(100vw - 24px)", top: 24 }}
      destroyOnHidden
      footer={
        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
          <Space size={12} wrap className="tw-text-sm tw-text-gray-600">
            <span>
              <SafetyCertificateOutlined /> {approvalSteps.length} bước duyệt
            </span>
            <span>
              <EyeOutlined /> {steps.length - approvalSteps.length} người liên quan
            </span>
            <span>
              <ClockCircleOutlined /> {totalHours ? `Tổng thời hạn ${totalHours} giờ` : "Không giới hạn thời gian"}
            </span>
          </Space>
          <Space>
            <Button onClick={onCancel}>Huỷ</Button>
            <Button type="primary" onClick={apply} icon={<CheckCircleFilled />}>
              Áp dụng luồng
            </Button>
          </Space>
        </div>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <div className="tw-grid tw-gap-4" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div className="tw-grid tw-gap-4 lg:tw-grid-cols-[minmax(0,1fr)_300px]">
            <div className="tw-min-w-0 tw-flex tw-flex-col tw-gap-3">
            {/* Bảng công cụ */}
            <div className="tw-grid tw-gap-2 sm:tw-grid-cols-2">
              <PaletteItem kind="approve" onAdd={add} />
              <PaletteItem kind="watch" onAdd={add} />
            </div>

            {/* Canvas */}
            <div className="tw-min-w-0">
              <div className="tw-text-[11px] tw-text-gray-400 tw-mb-1">
                Kéo công cụ ở trên vào luồng, kéo thẻ (biểu tượng ⠿) để đổi thứ tự. Đề xuất đi lần lượt qua từng bước duyệt từ trái sang phải.
              </div>
              <CanvasDropZone
                empty={
                  steps.length === 0 ? (
                    <div className="tw-pb-6">
                      <Empty description="Kéo “Bước duyệt” vào đây để bắt đầu" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </div>
                  ) : null
                }
              >
                <Terminal icon={<UserOutlined />} label="Người đề xuất" sub="Gửi đề xuất" color="#52c41a" />
                <Arrow />
                <SortableContext items={steps.map((s) => s.key)} strategy={horizontalListSortingStrategy}>
                  {steps.map((s) => (
                    <div key={s.key} className="tw-flex tw-items-center">
                      <StepCard
                        step={s}
                        order={orderOf(s.key)}
                        selected={s.key === selectedKey}
                        hasError={showErrors && errorKeys.has(s.key)}
                        peopleMap={peopleMap}
                        onSelect={setSelectedKey}
                      />
                      <Arrow />
                    </div>
                  ))}
                </SortableContext>
                <Terminal icon={<FlagOutlined />} label="Hoàn tất" sub="Đã phê duyệt" color="#1677ff" />
              </CanvasDropZone>
              {showErrors && errors.length > 0 && (
                <Alert
                  className="tw-mt-3"
                  type="warning"
                  showIcon
                  message="Luồng chưa hợp lệ"
                  description={
                    <ul className="tw-m-0 tw-pl-4">
                      {errors.map((e, i) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  }
                />
              )}
            </div>

            </div>

            {/* Thuộc tính */}
            <div className="tw-rounded-xl tw-border tw-border-solid tw-border-gray-200 tw-p-3 tw-bg-white" style={{ minHeight: 210 }}>
              <StepInspector
                step={selected}
                order={selected ? orderOf(selected.key) : 0}
                people={people}
                onChange={(next) => setSteps((prev) => prev.map((s) => (s.key === next.key ? next : s)))}
                onDelete={() => {
                  const idx = steps.findIndex((s) => s.key === selectedKey);
                  const rest = renumber(steps.filter((s) => s.key !== selectedKey));
                  setSteps(rest);
                  setSelectedKey(rest[Math.min(idx, rest.length - 1)]?.key || null);
                }}
                onDuplicate={() => {
                  const idx = steps.findIndex((s) => s.key === selectedKey);
                  const copy = { ...selected, key: uuidv4(), id_array_people: [...(selected.id_array_people || [])] };
                  setSteps((prev) => renumber([...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]));
                  setSelectedKey(copy.key);
                }}
              />
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragStep ? (
            <StepCard step={dragStep} order={orderOf(dragStep.key)} peopleMap={peopleMap} overlay />
          ) : dragPalette ? (
            <div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-lg tw-bg-white tw-shadow-xl tw-border tw-border-solid tw-border-blue-300">
              <span style={{ color: dragPalette.color }}>{dragPalette.icon}</span>
              <span className="tw-text-sm tw-font-medium">{dragPalette.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bản xem trước gọn (đặt trong form) + nút mở trình thiết kế
// ---------------------------------------------------------------------------
export function ApprovalFlowSummary({ value: rawValue = [], people = [], onEdit, invalid }) {
  const value = useMemo(() => normalizeSteps(rawValue), [rawValue]);
  const peopleMap = useMemo(() => new Map(people.map((p) => [p.ma_nv, p])), [people]);
  let order = 0;
  return (
    <div
      className="tw-rounded-lg tw-p-3"
      style={{ background: "#fafafa", border: `1px ${invalid ? "solid #ff4d4f" : "dashed #d9d9d9"}` }}
    >
      {value.length === 0 ? (
        <div className="tw-text-sm tw-text-gray-500 tw-mb-2">Chưa có bước duyệt nào.</div>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-0 tw-mb-3">
          {value.map((s, i) => {
            if (s.is_flow) order += 1;
            return (
              <div key={s.key || i} className="tw-flex tw-gap-2">
                <div className="tw-flex tw-flex-col tw-items-center">
                  <span
                    className="tw-flex tw-items-center tw-justify-center tw-rounded-full tw-text-white tw-text-[11px] tw-font-semibold"
                    style={{ width: 20, height: 20, background: s.is_flow ? "#1677ff" : "#bfbfbf", flexShrink: 0 }}
                  >
                    {s.is_flow ? order : <EyeOutlined style={{ fontSize: 10 }} />}
                  </span>
                  {i < value.length - 1 && <span className="tw-w-[2px] tw-flex-1 tw-bg-gray-200" style={{ minHeight: 14 }} />}
                </div>
                <div className="tw-pb-2 tw-min-w-0 tw-flex-1">
                  <div className="tw-text-sm tw-font-medium tw-truncate">
                    {s.display_name || (s.is_flow ? `Bước duyệt ${order}` : "Người liên quan")}
                    {s.time_approve_flow ? <span className="tw-text-xs tw-text-gray-400 tw-font-normal"> · {s.time_approve_flow}h</span> : null}
                  </div>
                  <div className="tw-mt-1">
                    <PeopleAvatars ids={s.id_array_people} peopleMap={peopleMap} size={22} max={5} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button type={value.length ? "default" : "primary"} icon={<ApartmentOutlined />} block onClick={onEdit}>
        {value.length ? "Chỉnh sửa luồng duyệt" : "Thiết kế luồng duyệt"}
      </Button>
    </div>
  );
}
