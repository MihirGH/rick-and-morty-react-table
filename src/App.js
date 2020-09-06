import React, {
  useMemo,
  useRef,
  useCallback,
  useState,
  useReducer,
  useEffect
} from "react";
import { useTable } from "react-table";
import { useVirtual } from "react-virtual";

import _sortBy from "lodash/sortBy";
import _isEmpty from "lodash/isEmpty";

import "./styles.css";

const PAGE_SIZE = 20;

function tableStateReducer(state, action) {
  switch (action.type) {
    case "REQUEST_DATA_FOR_PAGE":
      return {
        statusByPage: { ...state.statusByPage, [action.page]: "PENDING" },
        dataByPage: {
          ...state.dataByPage,
          [action.page]: new Array(PAGE_SIZE).fill({})
        }
      };
    case "DATA_RECEIVE_FOR_PAGE":
      return {
        statusByPage: { ...state.statusByPage, [action.page]: "SUCCESS" },
        dataByPage: { ...state.dataByPage, [action.page]: action.data }
      };
    default:
      return state;
  }
}

function useMemoizedPrepareRow(prepareRow) {
  const cachedPreparedRows = useRef({});
  const cachedRows = useRef({});
  return useCallback(
    ({ row, rowIndex }) => {
      if (cachedRows.current[rowIndex] !== row.original) {
        console.log(
          "recomputing for",
          rowIndex,
          "previous",
          cachedRows.current[rowIndex],
          row.original
        );
        prepareRow(row);
        cachedRows.current[rowIndex] = row.original;
        cachedPreparedRows.current[rowIndex] = row;
      }
      return cachedPreparedRows.current[rowIndex];
    },
    [prepareRow]
  );
}

function useTableData() {
  const [size, setSize] = useState(0);
  const [state, dispatch] = useReducer(tableStateReducer, {
    statusByPage: {},
    dataByPage: { 0: [] }
  });
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (
      state.statusByPage[currentPage] === "PENDING" ||
      state.statusByPage[currentPage] === "SUCCESS"
    )
      return;

    dispatch({ type: "REQUEST_DATA_FOR_PAGE", page: currentPage });

    fetch(`https://rickandmortyapi.com/api/character/?page=${currentPage + 1}`)
      .then(data => data.json())
      .then(data => {
        const { info, results } = data;
        setSize(info.count);
        dispatch({
          type: "DATA_RECEIVE_FOR_PAGE",
          data: results,
          page: currentPage
        });
      });
  }, [currentPage, size, state]);

  const data = useMemo(
    () =>
      _sortBy(Object.keys(state.dataByPage)).reduce(
        (acc, page) => [...acc, ...state.dataByPage[page]],
        []
      ),
    [state.dataByPage]
  );

  const fetchMore = useCallback((startIndex, endIndex) => {
    const page = Math.floor(endIndex / PAGE_SIZE);
    setCurrentPage(page);
  }, []);

  return {
    size,
    data,
    fetchMore
  };
}

function Table() {
  const columns = useMemo(
    () => [
      { id: "name", accessor: "name", Header: <strong>Name</strong> },
      { id: "status", accessor: "status", Header: <strong>Status</strong> },
      { id: "species", accessor: "species", Header: <strong>Species</strong> },
      { id: "type", accessor: "type", Header: <strong>Type</strong> },
      {
        id: "location",
        accessor: "location.name",
        Header: <strong>Location</strong>
      },
      {
        id: "origin",
        accessor: "origin.name",
        Header: <strong>Origin</strong>
      },
      { id: "gender", accessor: "gender", Header: <strong>Gender</strong> }
    ],
    []
  );

  const tableContainerRef = useRef();
  const { size, data, fetchMore } = useTableData();
  const rowSizeEstimator = useCallback(() => 45, []);
  const columnSizeEstimator = useCallback(() => 250, []);
  const { rows, headers, prepareRow } = useTable({ columns, data });
  // const memoizedPrepareRow = useMemoizedPrepareRow(prepareRow);

  const rowVirtualizer = useVirtual({
    size: size,
    parentRef: tableContainerRef,
    estimateSize: rowSizeEstimator,
    horizontal: false
  });

  const columnVirtualizer = useVirtual({
    size: columns.length,
    parentRef: tableContainerRef,
    estimateSize: columnSizeEstimator,
    horizontal: true
  });

  const headerVirtualizer = useVirtual({
    size: columns.length,
    parentRef: tableContainerRef,
    estimateSize: columnSizeEstimator,
    horizontal: true
  });

  useEffect(() => {
    const { virtualItems } = rowVirtualizer;
    const startIndex = virtualItems[0]?.index;
    const endIndex = virtualItems[virtualItems.length - 1]?.index;
    if (startIndex !== undefined && endIndex !== undefined)
      fetchMore(startIndex, endIndex);
  }, [rowVirtualizer, fetchMore]);

  return (
    <div className="tableContainer" ref={tableContainerRef}>
      <div
        style={{
          width: `${headerVirtualizer.totalSize}px`,
          position: "sticky",
          height: "40px",
          top: 0,
          background: "#c9c7c7",
          zIndex: 2
        }}
      >
        {headerVirtualizer.virtualItems.map(vHeader => {
          const headerIndex = vHeader.index;
          return (
            <div
              className="flex items-center"
              key={vHeader.index}
              style={{
                height: "40px",
                width: `${vHeader.size}px`,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translateX(${vHeader.start}px)`,
                borderBottom: "1px solid black",
                borderRight: "1px solid black",
                padding: "4px 8px"
              }}
            >
              {headers[headerIndex].render("Header")}
            </div>
          );
        })}
      </div>
      <div
        style={{
          height: `${rowVirtualizer.totalSize}px`,
          width: `${columnVirtualizer.totalSize}px`,
          position: "relative"
        }}
      >
        {rowVirtualizer.virtualItems.map(vRow => {
          const rowIndex = vRow.index;
          const row = rows[rowIndex];
          const isRowLoaded = !_isEmpty(row);
          if (isRowLoaded) prepareRow(row);

          return (
            <React.Fragment key={vRow.index}>
              {columnVirtualizer.virtualItems.map(vCol => {
                const colIndex = vCol.index;
                return (
                  <div
                    className="pos-absolute left-0 top-0 flex items-center"
                    key={vCol.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: `${vCol.size}px`,
                      height: `${vRow.size}px`,
                      transform: `translateX(${vCol.start}px) translateY(${
                        vRow.start
                      }px)`,
                      padding: "4px 8px",
                      borderBottom: "1px solid black",
                      borderRight: "1px solid black"
                    }}
                  >
                    {isRowLoaded
                      ? row.cells[colIndex].render("Cell")
                      : "Wubba Lubba Dub Dub"}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="App">
      <h1>
        <em>Rick and Morty</em> characters
      </h1>
      <Table />
      <footer>
        Thanks to the creators/maintainers of{" "}
        <a href="https://github.com/tannerlinsley/react-table">react-table</a>,
        <a href="https://github.com/tannerlinsley/react-virtual">
          {" "}
          react-virtual{" "}
        </a>{" "}
        and <a href="https://rickandmortyapi.com/">rickandmortyapi.com</a>
      </footer>
    </div>
  );
}
