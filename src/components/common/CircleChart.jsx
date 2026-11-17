import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#22c55e", "#FF3131", "#FFBB28"];

const CircleChart = ({ data }) => {
  const [isMobile, setIsMobile] = useState(false);

  // Theo dõi kích thước màn hình
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize(); // Chạy lần đầu
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: "100%", height: isMobile ? 400 : 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            // Mobile: căn giữa (50%), PC: lệch trái (40%)
            cx={isMobile ? "50%" : "40%"}
            cy="50%"
            labelLine={false}
            // Không vẽ nhãn trên lát: Legend đã ghi "tên: số", nhãn lát bị cắt chữ khi khung hẹp
            label={false}
            outerRadius={isMobile ? 80 : 80}
            innerRadius={isMobile ? 40 : 40}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            // Mobile: Đưa Legend xuống dưới, PC: Để bên phải
            layout={isMobile ? "horizontal" : "vertical"}
            align={isMobile ? "center" : "right"}
            verticalAlign={isMobile ? "bottom" : "middle"}
            // iconType="circle"
            // formatter={(value) => {
            //   const entry = data.find((i) => i.name === value);
            //   return (
            //     <span style={{ color: "#333", fontSize: "14px" }}>
            //       {value}: {entry ? entry.value : 0}
            //     </span>
            //   );
            // }}
            formatter={(value) => {
              const entry = data.find((i) => i.name === value);
              return `${value}: ${entry ? entry.value : 0}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CircleChart;
