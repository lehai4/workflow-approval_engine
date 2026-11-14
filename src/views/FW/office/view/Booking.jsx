import { useSearchParams } from "react-router-dom";
import DashBoardOffice from "./DashBoard";
import ManagerResource from "./ManagerResource";
import ResourceRegistration from "./ResourceRegistration";
const Booking = () => {
  const [searchParam] = useSearchParams();

  // const group = searchParam.get("group");
  // const resource = searchParam.get("resource");
  // const uid = searchParam.get("uid");
  const view = searchParam.get("view");

  //Trang dashboard
  if (view === "dashboard") {
    return <DashBoardOffice />;
  }

  //Trang đăng ký tài nguyên
  if (view === "booking") {
    return <ResourceRegistration />;
  }

  //Trang quản lý tài nguyên
  if (view === "resource") {
    return <ManagerResource />;
  }

  return <div>Booking</div>;
};

export default Booking;
