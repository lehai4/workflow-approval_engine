import { CloseOutlined, SelectOutlined } from "@ant-design/icons";
import { Drawer } from "antd";
import {
  Button,
  Col,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Table,
  Typography,
} from "antd";

const SuggestionLinkProposal = ({
  type,
  width,
  style,
  openDrawerLinkProposal,
  updateSearch,
  setOpenDrawerLinkProposal,
  setSearchInput,
  proposalType,
  proposalReality,
  colummListProposalType,
  rowSelection,
  itemSelected,
  rowSelectionSelected,
  handleSelectedLinkProposal,
  handleCloseModalSelectedLinkProposal,
  handleDeleteItemSelectedLinkProposal,
}) => {
  // console.log("proposalReality", proposalReality);
  return (
    <>
      {type === "Modal" ? (
        <>
          <Modal
            open={openDrawerLinkProposal}
            onCancel={() => setOpenDrawerLinkProposal(false)}
            placement="top"
            title="Chọn đề xuất"
            width={width}
            style={style}
            footer={
              <div className="tw-flex tw-flex-row tw-items-center tw-justify-end tw-gap-x-2">
                <Button
                  icon={<SelectOutlined />}
                  type="primary"
                  htmlType="submit"
                  onClick={handleSelectedLinkProposal}
                >
                  Chọn
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  onClick={handleCloseModalSelectedLinkProposal}
                >
                  Đóng
                </Button>
              </div>
            }
          >
            <div className="tw-w-full tw-overflow-hidden">
              <header>
                <div className="tw-w-full">
                  <Row gutter={16}>
                    <Col xs={24} sm={24} md={12}>
                      <label className="tw-my-2">Tìm kiếm đề xuất</label>
                      <Input
                        placeholder="Tìm kiếm tên/loại đề xuất"
                        className="tw-w-full"
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <label className="tw-my-2">Lọc theo loại đề xuất</label>
                      <div className="">
                        <Select
                          placeholder="Chọn loại đề xuất"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                          className="tw-w-full"
                          onChange={(e) => {
                            updateSearch("addLinkProposal", {
                              nameProposalType: e,
                            });
                          }}
                        >
                          {proposalType &&
                            proposalType.map((item) => (
                              <Select.Option value={item.uid} key={item.uid}>
                                {item.name_proposal_type}
                              </Select.Option>
                            ))}
                        </Select>
                      </div>
                    </Col>
                  </Row>
                </div>
              </header>
              <Divider />
              <div className="">
                <Typography.Text className="tw-my-2 tw-block">
                  Danh sách đề xuất ({proposalType ? proposalReality.length : 0}
                  )
                </Typography.Text>
                <Table
                  dataSource={
                    proposalReality &&
                    proposalReality.map((item, i) => ({
                      ...item,
                      key: item.uid,
                    }))
                  }
                  columns={colummListProposalType}
                  pagination={{ pageSize: 8 }}
                  rowKey={(record) => record.uid}
                  locale={{
                    emptyText:
                      "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
                  }}
                  scroll={{ x: "max-content", y: 50 * 5 }}
                  rowSelection={{ ...rowSelection }}
                />
              </div>
              <Divider />
              <div className="">
                <Typography.Text className="tw-my-2 tw-block">
                  Danh sách đã chọn ({itemSelected.length})
                </Typography.Text>
                <div className="tw-my-2">
                  <Button onClick={handleDeleteItemSelectedLinkProposal}>
                    Xóa
                  </Button>
                </div>
                <Table
                  dataSource={itemSelected.map((item, i) => ({
                    ...item,
                    key: `table2-${item.uid}`,
                  }))}
                  columns={[
                    {
                      title: "STT",
                      dataIndex: "stt",
                      key: "stt",
                      width: 60,
                      ellipsis: true,
                      fixed: "left",
                      render: (_text, _record, index) => (
                        <span>{index + 1}</span>
                      ),
                    },
                    ...colummListProposalType,
                  ]}
                  pagination={{ pageSize: 8 }}
                  locale={{
                    emptyText:
                      "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
                  }}
                  scroll={{ x: "max-content", y: 50 * 5 }}
                  rowKey={(record) => `table2-${record.uid}`}
                  rowSelection={{ ...rowSelectionSelected }}
                />
              </div>
            </div>
          </Modal>
        </>
      ) : (
        <>
          <Drawer
            open={openDrawerLinkProposal}
            onClose={() => setOpenDrawerLinkProposal(false)}
            closable={false}
            placement="top"
            width="100vw"
            style={{
              height: "100vh",
              backgroundColor: "rgb(243 244 246)",
            }}
            title="Chọn đề xuất"
            extra={
              <div className="tw-flex tw-flex-row tw-items-center tw-justify-end tw-gap-x-2">
                <Button
                  icon={<SelectOutlined />}
                  type="primary"
                  htmlType="submit"
                  onClick={handleSelectedLinkProposal}
                >
                  Chọn
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  onClick={handleCloseModalSelectedLinkProposal}
                >
                  Đóng
                </Button>
              </div>
            }
          >
            <div className="tw-w-full tw-overflow-hidden">
              <header>
                <div className="tw-w-full">
                  <Row gutter={16}>
                    <Col xs={24} sm={24} md={12}>
                      <label className="tw-my-2">Tìm kiếm đề xuất</label>
                      <Input
                        placeholder="Tìm kiếm tên/loại đề xuất"
                        className="tw-w-full"
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                    </Col>
                    <Col xs={24} sm={24} md={12}>
                      <label className="tw-my-2">Lọc theo loại đề xuất</label>
                      <div className="">
                        <Select
                          placeholder="Chọn loại đề xuất"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                          className="tw-w-full"
                          onChange={(e) => {
                            updateSearch("addLinkProposal", {
                              nameProposalType: e,
                            });
                          }}
                        >
                          {proposalType &&
                            proposalType.map((item) => (
                              <Select.Option value={item.uid} key={item.uid}>
                                {item.name_proposal_type}
                              </Select.Option>
                            ))}
                        </Select>
                      </div>
                    </Col>
                  </Row>
                </div>
              </header>
              <Divider />
              <div className="">
                <Typography.Text className="tw-my-2 tw-block">
                  Danh sách đề xuất ({proposalType ? proposalReality.length : 0}
                  )
                </Typography.Text>
                <Table
                  dataSource={
                    proposalReality &&
                    proposalReality.map((item, i) => ({
                      ...item,
                      key: item.uid,
                    }))
                  }
                  columns={colummListProposalType}
                  pagination={{ pageSize: 8 }}
                  rowKey={(record) => record.uid}
                  locale={{
                    emptyText:
                      "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
                  }}
                  scroll={{ x: "max-content", y: 50 * 5 }}
                  rowSelection={{ ...rowSelection }}
                />
              </div>
              <Divider />
              <div className="">
                <Typography.Text className="tw-my-2 tw-block">
                  Danh sách đã chọn ({itemSelected.length})
                </Typography.Text>
                <div className="tw-my-2">
                  <Button onClick={handleDeleteItemSelectedLinkProposal}>
                    Xóa
                  </Button>
                </div>
                <Table
                  dataSource={itemSelected.map((item, i) => ({
                    ...item,
                    key: `table2-${item.uid}`,
                  }))}
                  columns={[
                    {
                      title: "STT",
                      dataIndex: "stt",
                      key: "stt",
                      width: 60,
                      ellipsis: true,
                      render: (_text, _record, index) => (
                        <span>{index + 1}</span>
                      ),
                    },
                    ...colummListProposalType,
                  ]}
                  pagination={{ pageSize: 8 }}
                  locale={{
                    emptyText:
                      "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
                  }}
                  scroll={{ x: "max-content", y: 50 * 5 }}
                  rowKey={(record) => `table2-${record.uid}`}
                  rowSelection={{ ...rowSelectionSelected }}
                />
              </div>
            </div>
          </Drawer>
        </>
      )}
    </>
  );
};

export default SuggestionLinkProposal;
