// EventWithTooltip.jsx
import React from "react";
import dayjs from "dayjs";
import { usePopperTooltip } from "react-popper-tooltip";
import "react-popper-tooltip/dist/styles.css";
import { Typography } from "antd";

const EventWithTooltip = ({ event, handleSelectEvent }) => {
  const {
    getArrowProps,
    getTooltipProps,
    setTooltipRef,
    setTriggerRef,
    visible,
  } = usePopperTooltip({
    placement: "top",
    trigger: "hover",
    followCursor: true,
  });

  //   console.log("event", event);
  return (
    <>
      {/* TRIGGER */}
      <span
        ref={setTriggerRef}
        className="tw-flex tw-items-center tw-gap-1"
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectEvent(event);
        }}
      >
        {/* {event.status === "canceled" && <span title="Đã hủy">Huỷ</span>}
        {event.status === "rejected" && <span title="Đã từ chối">Từ chối</span>} */}

        <span>
          {dayjs(event.start).format("HH:mm")} {event.title}
        </span>
      </span>

      {/* TOOLTIP */}
      {visible && (
        <div
          ref={setTooltipRef}
          {...getTooltipProps({
            className: "tooltip-container",
          })}
        >
          <div {...getArrowProps({ className: "tooltip-arrow" })} />
          <div className="tooltip-body">
            <Typography.Text strong>
              {event.ma_nv && <>{event.ten_nv} </>}
            </Typography.Text>
            đăng ký{" "}
            <div>
              từ{" "}
              <Typography.Text strong>
                {dayjs(event.start).format("HH:mm")}{" "}
              </Typography.Text>
              đến{" "}
              <Typography.Text strong>
                {dayjs(event.end).format("HH:mm")}
              </Typography.Text>{" "}
              để họp{" "}
            </div>
            <Typography.Text strong>{event.title}</Typography.Text>
            {/* <div>
              <strong>{event.title}</strong>
            </div>
            <div>
              Thời gian bắt đầu: {dayjs(event.start).format("DD/MM/YYYY HH:mm")}
            </div>
            <div>
              Thời gian kết thúc:{dayjs(event.end).format("DD/MM/YYYY HH:mm")}
            </div>
            {event.ma_nv && <div>Người đăng ký: {event.ten_nv}</div>}
            {event.status && (
              <div>
                Trạng thái:{" "}
                {event.status === "canceled"
                  ? "Đã hủy"
                  : event.status === "rejected"
                  ? "Bị từ chối"
                  : event.status}
              </div>
            )} */}
          </div>
        </div>
      )}
    </>
  );
};

export default EventWithTooltip;
