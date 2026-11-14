import { useState } from "react";
import { Calendar } from "react-big-calendar";
// import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { localizer } from "./localizer";
import EventWithTooltip from "./EventWithTooltip";

const messages = {
  today: "Hôm nay",
  previous: "Trước",
  next: "Sau",
  month: "Tháng",
  week: "Tuần",
  work_week: "Tuần làm việc",
  day: "Ngày",
  agenda: "Lịch biểu",
  date: "Ngày",
  time: "Giờ",
  event: "Sự kiện",
  noEventsInRange: "Không có sự kiện trong khoảng thời gian này.",
};

const Index = ({
  eventsData,
  view,
  setView,
  handleSelect,
  handleSelectEvent,
  eventPropGetter,
}) => {
  // const DnDCalender = withDragAndDrop(Calendar);
  const [culture, setCulture] = useState("vi");
  const [dark, setDark] = useState(false);
  return (
    <div
      className={
        dark
          ? "dark tw-p-4 tw-min-h-screen tw-bg-gray-900"
          : "tw-p-4 tw-min-h-screen tw-bg-gray-100"
      }
    >
      <div className="tw-flex tw-gap-2 tw-mb-4">
        <button
          onClick={() => setCulture("vi")}
          className={`tw-px-4 tw-py-2 tw-rounded ${
            culture === "vi" ? "tw-bg-blue-600 tw-text-white" : "tw-bg-gray-200"
          }`}
        >
          🇻🇳 Tiếng Việt
        </button>
        <button
          onClick={() => setCulture("en-US")}
          className={`tw-px-4 tw-py-2 tw-rounded ${
            culture === "en-US"
              ? "tw-bg-blue-600 tw-text-white"
              : "tw-bg-gray-200"
          }`}
        >
          🇺🇸 English
        </button>
        <button
          onClick={() => setDark(!dark)}
          className={`tw-px-4 tw-py-2 tw-rounded ${
            dark
              ? "tw-bg-yellow-500 tw-text-black"
              : "tw-bg-gray-800 tw-text-white"
          }`}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      <Calendar
        views={["month", "week", "day", "work_week", "agenda"]}
        selectable
        view={view}
        longPressThreshold={150} // cho phép tap nhanh trên mobile
        localizer={localizer}
        defaultDate={new Date()}
        defaultView="month"
        events={eventsData}
        culture={culture}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100vh" }}
        onSelectEvent={(event) => handleSelectEvent(event)} // backup
        onSelectSlot={handleSelect} // nhấn vào ô trống để đăng ký
        // onEventDrop={() => {}}
        eventPropGetter={eventPropGetter}
        messages={messages}
        step={15}
        showMultiDayTimes
        onView={(view) => setView(view)}
        components={{
          event: (props) => (
            <EventWithTooltip
              {...props}
              handleSelectEvent={handleSelectEvent}
            />
          ),
        }}
        // components={{
        //   event: ({ event }) => (
        //     <span
        //       className="tw-flex tw-items-center tw-gap-1"
        //       onClick={(e) => {
        //         e.stopPropagation(); // tránh trigger chọn slot
        //         handleSelectEvent(event);
        //       }}
        //       style={{ cursor: "pointer" }}
        //     >
        //       {event.status === "canceled" && (
        //         <Tooltip title="Đã hủy">
        //           <span>❌</span>
        //         </Tooltip>
        //       )}

        //       {event.status === "rejected" && (
        //         <Tooltip title="Đã từ chối">
        //           <span>❗</span>
        //         </Tooltip>
        //       )}

        //       <span>
        //         {dayjs(event.start).format("HH:mm")} {event.title}
        //       </span>
        //     </span>
        //   ),
        // }}
      />
    </div>
  );
};

export default Index;
