import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'


const root = <TJson extends object>() => fetch("https://svs.gsfc.nasa.gov/api/40467").then((response) => response.json()).then((data: TJson) => console.log(data.toString()))
root();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
