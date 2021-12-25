import React from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { AppContext } from "../contexts/app.context";

export default function LoginPage() {
  const navigate = useNavigate();
  const appContext = React.useContext(AppContext);

  const [state, setState] = React.useState({
    username: "",
    password: "",
    hidden: false,
  });

  const onSubmit = async (e) => {
    e.preventDefault();

    try {
      const { data, status } = await axios.post(`/login`, {
        username: state.username,
        password: state.password,
      });

      appContext.setAppState({
        isLoggedIn: true,
        username: state.username,
        jwt_token: data.token,
      });

      Swal.fire({
        title: "Login Success!",
        icon: "success",
      });

      navigate("/");
    } catch (error) {
      Swal.fire({
        title: error.response?.data?.error || "Somthing went wrong..",
        icon: "error",
      });
      console.log(error);
    }
  };

  return (
    <>
      <div className="flex justify-center shadow-md bg-gray-700 p-5">
        <div className="flex font-semibold text-xl text-white">
          IoT based Atmosphere Monitering and Logging system with Home
          Automation
        </div>
      </div>
      <div className="w-full max-w-sm mx-auto py-12 px-1 md:px-0 ">
        <form
          className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8 mb-4 border border-gray-400"
          onSubmit={onSubmit}
        >
          <h2 className="py-4 mx-auto w-full mt-4 mb-4 content-center text-center text-2xl ">
            <i className="fas fa-lock mr-1"></i> User Login
          </h2>

          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="data"
            >
              Username
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="data"
              type="text"
              name="data"
              placeholder="Username"
              autoCapitalize="none"
              value={state.username}
              onChange={(e) => setState({ ...state, username: e.target.value })}
              required
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              type={state.hidden ? "password" : "text"}
              id="password"
              placeholder="********"
              name="password"
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
              required
            />

            <div className="w-full flex justify-end noselect">
              <span
                onClick={() => setState({ ...state, hidden: !state.hidden })}
                className="text-gray-600 hover:text-gray-800"
                style={{
                  cursor: "pointer",
                }}
              >
                {state.hidden ? (
                  <>
                    <i className="fas fa-eye" aria-hidden="true"></i>
                    &nbsp; Show Password
                  </>
                ) : (
                  <>
                    <i className="fas fa-eye-slash" aria-hidden="true"></i>
                    &nbsp; Hide Password
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex mx-auto justify-around">
            <button
              className={`shadow-md bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
              type="submit"
            >
              <i className="fas fa-sign-in-alt mr-2"></i>Login
            </button>

            <Link
              to="/signup"
              className="inline-block my-auto shadow-md align-baseline link bg-purple-500 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Signup Instead
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
