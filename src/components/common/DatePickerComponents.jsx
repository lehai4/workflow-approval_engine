import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import { toast } from "react-toastify";
import "react-datepicker/dist/react-datepicker.css";

const SingleMonthPicker = ({ onChange }) => {
  const [selectedDate, setSelectedDate] = useState(null);

  const handleChange = (date) => {
    setSelectedDate(date);
    onChange(date);
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="MM/yyyy"
      showMonthYearPicker
      className="form-control single-month"
    />
  );
};

const SingleDateTimePicker = ({
  value,
  onChange,
  name,
  placeholderText = null,
  required = false,
  disabled = null,
}) => {
  // Chuyển đổi giá trị từ Form.Item (nếu có) sang Date object
  const selectedDate = value ? new Date(value) : null;

  // Xử lý khi người dùng chọn ngày/giờ
  const handleChange = (date) => {
    onChange(date); // Truyền giá trị Date trực tiếp về Form
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      timeCaption="Giờ"
      dateFormat="dd/MM/yyyy HH:mm"
      placeholderText={placeholderText || "Chọn ngày và giờ"}
      className="form-control single-date-time compact-datepicker"
      name={name}
      disabled={disabled ? disabled : false}
      required={required}
      autoComplete="off"
      popperClassName="ant-picker-dropdown datepicker-popper"
    />
  );
};

const RangeDateTimePicker = ({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onChange,
  name,
}) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    setStartDate(initialStartDate ? new Date(initialStartDate) : null);
    setEndDate(initialEndDate ? new Date(initialEndDate) : null);
  }, [initialStartDate, initialEndDate]);

  const handleStartChange = (date) => {
    setStartDate(date);
    onChange([date, endDate]);
  };

  const handleEndChange = (date) => {
    setEndDate(date);
    onChange([startDate, date]);
  };

  return (
    <div className="d-flex">
      <DatePicker
        selected={startDate}
        onChange={handleStartChange}
        selectsStart
        startDate={startDate}
        endDate={endDate}
        showTimeSelect
        name={name}
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Time"
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText="Ngày bắt đầu"
        required
        className="form-control range-date-time"
      />
      <DatePicker
        selected={endDate}
        onChange={handleEndChange}
        selectsEnd
        required
        startDate={startDate}
        endDate={endDate}
        name={name}
        minDate={startDate}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Time"
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText="Ngày kết thúc"
        className="form-control range-date-time"
      />
    </div>
  );
};

const RangeDatePicker = ({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onChange,
  name,
  minDate = null,
  maxDate = null,
}) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    setStartDate(initialStartDate ? new Date(initialStartDate) : null);
    setEndDate(initialEndDate ? new Date(initialEndDate) : null);
  }, [initialStartDate, initialEndDate]);

  const handleStartChange = (date) => {
    setStartDate(date);
    onChange([date, endDate]);
  };

  const handleEndChange = (date) => {
    setEndDate(date);
    onChange([startDate, date]);
  };

  return (
    <div className="d-flex">
      <DatePicker
        selected={startDate}
        onChange={handleStartChange}
        selectsStart
        startDate={startDate}
        endDate={endDate}
        minDate={minDate}
        maxDate={maxDate}
        name={name}
        dateFormat="dd/MM/yyyy"
        placeholderText="Ngày bắt đầu"
        required
        autoComplete="off"
        className="form-control range-date-time"
      />
      <DatePicker
        selected={endDate}
        onChange={handleEndChange}
        selectsEnd
        required
        startDate={startDate}
        endDate={endDate}
        name={name}
        minDate={startDate || minDate}
        maxDate={maxDate}
        dateFormat="dd/MM/yyyy"
        placeholderText="Ngày kết thúc"
        autoComplete="off"
        className="form-control range-date-time"
      />
    </div>
  );
};

const RangeDateTimePickerByMonthYear = ({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onChange,
}) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    setStartDate(initialStartDate ? new Date(initialStartDate) : null);
    setEndDate(initialEndDate ? new Date(initialEndDate) : null);
  }, [initialStartDate, initialEndDate]);

  const handleStartChange = (date) => {
    setStartDate(date);
    onChange([date, endDate]);
  };

  const handleEndChange = (date) => {
    setEndDate(date);
    onChange([startDate, date]);
  };

  return (
    <div className="d-flex">
      <DatePicker
        selected={startDate}
        onChange={handleStartChange}
        selectsStart
        startDate={startDate}
        endDate={endDate}
        showMonthYearPicker // Show only month and year
        minDate={new Date(new Date().getFullYear(), 0, 1)} // Minimum date is January of the current year
        placeholderText="Tháng/năm bắt đầu"
        className="form-control range-date-time"
        dateFormat="MM/yyyy"
      />
      <DatePicker
        selected={endDate}
        onChange={(date) => {
          if (!startDate) {
            toast.warning(`Vui lòng chọn ngày bắt đầu trước.`);
            return;
          }
          const startYear = startDate.getFullYear();
          const selectedYear = date ? date.getFullYear() : null;

          // Kiểm tra xem năm của ngày kết thúc có phải là năm bắt đầu không
          if (selectedYear && selectedYear !== startYear) {
            toast.warning(
              `Thời gian kết thúc chỉ được chọn trong năm ${startYear}.`
            );
            return;
          }
          handleEndChange(date);
        }}
        selectsEnd
        startDate={startDate}
        endDate={endDate}
        minDate={startDate} // Đảm bảo minDate cho endDate là ngày bắt đầu
        placeholderText="Tháng/năm kết thúc"
        showMonthYearPicker // Show only month and year
        maxDate={
          startDate
            ? new Date(new Date().setFullYear(startDate.getFullYear(), 11, 31))
            : null
        } // Maximum date is December of the year of startDate
        className="form-control range-date-time"
        dateFormat="MM/yyyy"
      />
    </div>
  );
};

const SingleDatePicker = ({ onChange, placeholderText = null }) => {
  const [selectedDate, setSelectedDate] = useState(null);

  const handleChange = (date) => {
    setSelectedDate(date);
    onChange(date);
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="dd/MM/yyyy"
      className="form-control single-date"
      placeholderText={placeholderText || null}
    />
  );
};

export {
  SingleMonthPicker,
  RangeDateTimePicker,
  RangeDatePicker,
  SingleDatePicker,
  RangeDateTimePickerByMonthYear,
  SingleDateTimePicker,
};
