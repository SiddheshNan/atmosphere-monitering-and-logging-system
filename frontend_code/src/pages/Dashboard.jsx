import React from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import Swal from "sweetalert2";
import { AppContext } from "../contexts/app.context";
import { APP_STATE } from "../helpers";

let typeIsRealtime = false;

export default function Dashboard() {
  const appContext = React.useContext(AppContext);

  const [switchState, setSwitchState] = React.useState({
    led: false,
    fan: false,
  });

  const [atmosphereState, setAtmosphereState] = React.useState({
    temp: false,
    hum: false,
  });

  const [historyData, setHistoryData] = React.useState({
    temp: [],
    hum: [],
    timestamp: [],
  });

  const [realtime, setRealtime] = React.useState(false);

  React.useEffect(() => {
    fetchGraph();
    fetchSwitch();

    const req_loop1 = setInterval(async () => {
      fetchSwitch(req_loop1);
    }, 1000);

    const req_loop2 = setInterval(() => {
      fetchGraph(req_loop2);
    }, 1000);

    // clear the setInterval(s) when component unmounts..
    return () => {
      req_loop1 && clearInterval(req_loop1);
      req_loop2 && clearInterval(req_loop2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGraph = async (req_loop2) => {
    const ITEM_LIMIT = 512;
    try {
      const _link = typeIsRealtime ? "/graph/realtime" : "/graph/group_by_min";

      const { data } = await axios.get(_link, {
        params: {
          items_limit: ITEM_LIMIT,
          time_interval: 50, // the diff between 2 points
          limit: ITEM_LIMIT,
        },
      });

      const _temp = [];
      const _hum = [];
      const _time = [];

      for (let i = 0; i < data.output.length; i++) {
        _temp.push(data.output[i].data.temp);
        _hum.push(data.output[i].data.hum);
        _time.push(data.output[i].time);
      }

      setHistoryData({
        temp: _temp,
        hum: _hum,
        timestamp: _time,
      });
    } catch (error) {
      req_loop2 && clearInterval(req_loop2);
      Swal.fire({
        title: error.response?.data?.error || "Somthing went wrong..",
        icon: "error",
      });
      console.log(error);
    }
  };

  const fetchSwitch = async (req_loop1) => {
    try {
      const { data } = await axios.get(`/state`);
      setAtmosphereState({
        temp: data.temp,
        hum: data.hum,
      });
      setSwitchState({
        led: data.led,
        fan: data.fan,
      });
    } catch (error) {
      req_loop1 && clearInterval(req_loop1);
      Swal.fire({
        title: error.response?.data?.error || "Somthing went wrong..",
        icon: "error",
      });
      console.log(error);
    }
  };

  const sendState = async (state) => {
    try {
      await axios.post(`/state`, {
        ...state,
      });

    } catch (error) {
      Swal.fire({
        title: error.response?.data?.error || "Somthing went wrong..",
        icon: "error",
      });
      console.log(error);
    }
  };

  return (
    <div className="h-screen w-full">
      <div className="flex justify-center shadow-md bg-gray-700 p-4 pt-6 pb-4">
        <div className="flex font-semibold text-xl text-white">
          IoT based Atmosphere Monitering and Logging system with Home
          Automation
        </div>

        <div
          onClick={() =>
            Swal.fire({
              title: "Do you want to logout?",
              icon: "question",
              showCancelButton: true,
              confirmButtonText: "Yes, logout",
            }).then(({ isConfirmed }) => {
              if (isConfirmed) {
                appContext.setAppState({ ...APP_STATE });
                Swal.fire("Logged out!", "", "success");
              }
            })
          }
          className="flex font-semibold ml-10 bg-red-500 py-1 px-6 rounded-lg shadow-md cursor-pointer text-xl text-white"
        >
          Logout
        </div>
      </div>

      <div className="flex  mx-auto mt-6">
        <div className="m-4 w-4/6 ">
          <div className="container flex w-full items-center justify-center mb-4">
            <div
              className={`border ${
                realtime ? "bg-blue-500 " : "bg-green-500  shadow-lg "
              } text-white py-3 px-6 rounded-lg cursor-pointer`}
              onClick={() => {
                setRealtime(false);
                typeIsRealtime = false;
                setHistoryData({ temp: [], hum: [], timestamp: [] });
                fetchGraph();
              }}
            >
              <i className="fas fa-chart-area mr-2"></i> Aggrigated Graph
            </div>
            <div
              className={`border ${
                realtime ? "bg-green-500 shadow-lg " : "bg-blue-500"
              } text-white py-3 px-6 rounded-lg ml-6 cursor-pointer`}
              onClick={() => {
                setRealtime(true);
                typeIsRealtime = true;
                setHistoryData({ temp: [], hum: [], timestamp: [] });
                fetchGraph();
              }}
            >
              <i className="fas fa-clock mr-2"></i> Realtime Graph
            </div>
          </div>

          <Chart
            className=" bg-white rounded-md shadow-lg px-3 py-2 border mx-16 border-gray-400"
            options={{
              chart: {
                type: "area",
                height: 350,
                zoom: {
                  enabled: true,
                },
              },

              dataLabels: {
                enabled: false,
              },
              stroke: {
                curve: "smooth",
              },

              title: {
                text: `Atmospheric Variations - ${
                  realtime ? "Realtime" : `Aggrigated`
                }`,
                align: "left",
              },
              subtitle: {
                text: "Area Chart",
                align: "left",
              },

              xaxis: {
                type: "datetime",
                categories: historyData.timestamp,
                labels: {
                  format: "hh:mm:ss dd/MM/yy",
                  datetimeUTC: false,
                },
              },
              yaxis: {
                opposite: true,
              },
              legend: {
                horizontalAlign: "left",
              },
              tooltip: {
                x: {
                  format: "hh:mm:ss dd/MM/yy",
                },
              },
            }}
            series={[
              {
                name: "Temprature",
                data: historyData.temp,
              },
              {
                name: "Humidity",
                data: historyData.hum,
              },
            ]}
            type="area"
            height={350}
          />
        </div>

        <div className="w-2/6 pr-16">
          <div className="px-4 py-6 bg-blue-500 text-white text-xl font-bold rounded-lg justify-center flex shadow-md w-full">
            <div className="mx-auto inline-block">
              <div className="mb-2 text-white font-bold uppercase text-center">
                <i class="fas fa-bolt mr-1 text-yellow-400"></i> Realtime values
              </div>
              <div className="mt-4">
                <i className="fas fa-thermometer-half mr-1"></i> Temperature :{" "}
                {atmosphereState.temp ? `${atmosphereState.temp} °C` : "N/A"}
              </div>
              <div className="mt-1">
                <i class="fas fa-water mr-1"></i> Humidity :{" "}
                {atmosphereState.hum ? `${atmosphereState.hum} %` : "N/A"}
              </div>
            </div>
          </div>
          <div className="mt-6 px-4 py-6 bg-white text-center text-xl rounded-lg shadow-md bg-orange-500">
            <div className="mb-2 text-white font-bold uppercase">
              <i className="fas fa-tachometer-alt mr-1"></i> Switch Control
            </div>
            <div className="mt-5">
              <label
                className="block text-md text-white font-bold"
                htmlFor="fan"
              >
                <span><i className="fas fa-fan mr-1"></i> Fan</span>
              </label>

              <div
                className="relative cursor-pointer mt-2 mb-2 inline-block"
                onClick={() => {
                  setSwitchState({ ...switchState, fan: !switchState.fan });
                  sendState({ ...switchState, fan: !switchState.fan });
                }}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={!switchState.fan}
                  readOnly
                />
                <div className="w-12 h-6 w-6 bg-gray-400 rounded-full shadow-inner "></div>
                <div className="toggle__dot absolute w-8 h-8 bg-white rounded-full inset-y-0 left-0 shadow"></div>
              </div>
            </div>

            <div className="mt-3">
              <label
                className="block text-md text-white font-bold"
                htmlFor="led"
              >
                <span><i className="fas fa-lightbulb mr-1"></i> LED Light</span>
              </label>

              <div
                className="relative cursor-pointer mt-2 mb-2 inline-block "
                onClick={() => {
                  setSwitchState({ ...switchState, led: !switchState.led });
                  sendState({ ...switchState, led: !switchState.led });
                }}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={!switchState.led}
                  readOnly
                />
                <div className="w-12 h-6 w-6 bg-gray-400 rounded-full shadow-inner "></div>
                <div className="toggle__dot absolute w-8 h-8 bg-white rounded-full inset-y-0 left-0  shadow"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
     

    </div>
  );
}
