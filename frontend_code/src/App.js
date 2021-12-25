import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { APP_STATE } from "./helpers";

import { AppContext } from "./contexts/app.context";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

const STATE_LOCAL_STORE_KEY = "Mini-Project-Sipna-3rd";

function App(props) {
  const [loaded, setIsLoaded] = React.useState(false);

  const [state, setState] = React.useState({
    ...APP_STATE,
  });

  React.useEffect(() => {
    const localData = localStorage.getItem(STATE_LOCAL_STORE_KEY);
    localData && setState(JSON.parse(localData));
    setIsLoaded(true);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STATE_LOCAL_STORE_KEY, JSON.stringify(state));
  }, [state]);

  React.useEffect(() => {
    const isToken = !!state.jwt_token;
    
    axios.defaults.params = {}
    axios.defaults.params["authorization"] = isToken ? state.jwt_token : "";

    // axios.defaults.headers.common["Authorization"] = isToken
    //   ? `Bearer ${state.jwt_token}`
    //   : "";

    console.log(`updaing jwt_token state`);
  }, [state.jwt_token]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setAppState: setState,
      }}
    >
      <HashRouter>
        <Routes>
          {!state.isLoggedIn ? (
            <>
              <Route exact path="/" element={<Navigate to="/login" />} />
              <Route exact path="/login" element={<LoginPage {...props} />} />
              <Route exact path="/signup" element={<SignupPage {...props} />} />
            </>
          ) : (
            <>
              <Route exact path="/" element={<Dashboard {...props} />} />
            </>
          )}

          {loaded && (
            <Route path="*" exact element={<Navigate replace to="/" />} />
          )}
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
export default App;
