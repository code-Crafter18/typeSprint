
import {Routes,Route} from 'react-router-dom' ;
import {TypingTest} from "./TypingTest";
import {ResultPage} from "./ResultPage";
import React from 'react';

export function App(){
  return(
    <Routes>
        <Route index element={<TypingTest/>}/>  
        <Route path=
        "/results" element={<ResultPage/>}/>  
    </Routes>
  );
}

