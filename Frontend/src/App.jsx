import Home_page from './Pages/Home_page';
import Context from './Components/Context';
import { useEffect, useState, useRef } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Test from './Pages/test';
import { useUser, useClerk } from "@clerk/clerk-react";
import axios from 'axios';
import { io, } from "socket.io-client";



//I put it ouside from App-component bcz it will connect at once if i refresh the app-component
//const connecting = io('http://localhost:4000');

function App() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const { user, isLoaded } = useUser();




  /*----When a new user registered so this funcation will save the user in database----*/
  const saving_new_users = async () => {
    try {

      if (user && isLoaded) {
        const res = await axios.post("https://brilliant-mindfulness-production-4965.up.railway.app/api/user", {
          clerkId: user.id,
          name: user.fullName,
          email: user.primaryEmailAddress.emailAddress,
          image: user.imageUrl,
        });
        console.log(res.data);
      }

    } catch (error) {
      console.log(error)
    }
  }

  /*-----Getting all users which are saved in database----*/
  const Getting_All_Users = async () => {
    try {
      const res = await axios.get("https://brilliant-mindfulness-production-4965.up.railway.app/api/All_users")
      setUsers(res.data)

    } catch (error) {
      console.log(error)
    }

  }

  const filter_data = isLoaded && user
    ? users.filter((obj) => obj.clerkId !== user.id)
    : [];

  const test = () => {
    console.log(abc);
  }

  const For_Search = filter_data.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );


  useEffect(() => {
    saving_new_users();
  }, [user])

  useEffect(() => {
    Getting_All_Users();
  }, [])


  useEffect(() => {
    if (!isLoaded || !user) return;

    const newSocket = io("https://brilliant-mindfulness-production-4965.up.railway.app", {
      auth: {
        clerkId: user.id,
      },
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected:", newSocket.id);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, isLoaded]);

  const values = { setSearch, test, For_Search, socket };


  return (
    <>
      <Context.Provider value={values}>
        <BrowserRouter>
          <Routes>

            <Route path='/' element={<Home_page />} />

          </Routes>

        </BrowserRouter>
      </Context.Provider>
    </>
  )


}

export default App;
