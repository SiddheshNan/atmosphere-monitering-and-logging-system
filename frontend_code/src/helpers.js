export const APP_STATE = {
  isLoggedIn: false,
  username: "",
  jwt_token: "",
  setAppState: (state) => {},
};

export const isProd = process.env.NODE_ENV !== "development";

export const API_BASE_URL = isProd ? "/api" : "http://localhost:5050/api";
